import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import type { RspressPlugin } from "@rspress/core";

type IndexJson = {
  version?: number;
  modules?: Record<string, { repo?: string; tag?: string }>;
};

export type ModuleCatalogOptions = {
  localIndexCandidates: string[];
  remoteUrl: string;
  outFile: string;
  fallbackFile: string;
};

async function readIndex(opts: ModuleCatalogOptions): Promise<{
  data: IndexJson;
  source: string;
}> {
  for (const p of opts.localIndexCandidates) {
    if (existsSync(p) && p.endsWith("index.json")) {
      return {
        data: JSON.parse(readFileSync(p, "utf8")) as IndexJson,
        source: `local:${p}`,
      };
    }
  }
  try {
    const res = await fetch(opts.remoteUrl);
    if (res.ok) {
      return {
        data: (await res.json()) as IndexJson,
        source: opts.remoteUrl,
      };
    }
  } catch {
    // fall through
  }
  if (existsSync(opts.fallbackFile)) {
    const fallback = JSON.parse(readFileSync(opts.fallbackFile, "utf8")) as {
      modules: { id: string; repo?: string; tag?: string }[];
      source?: string;
    };
    return {
      data: {
        version: 1,
        modules: Object.fromEntries(
          (fallback.modules ?? []).map((m) => [
            m.id,
            { repo: m.repo, tag: m.tag },
          ])
        ),
      },
      source: fallback.source ?? "fallback",
    };
  }
  return { data: { version: 1, modules: {} }, source: "empty" };
}

function toRegistry(data: IndexJson, source: string) {
  const modules = Object.entries(data.modules ?? {})
    .map(([id, meta]) => ({
      id,
      repo: meta.repo,
      tag: meta.tag,
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
  return { version: data.version ?? 1, source, generatedAt: new Date().toISOString(), modules };
}

export function pluginModuleCatalog(opts: ModuleCatalogOptions): RspressPlugin {
  let registryJson = '{"version":1,"modules":[]}';

  return {
    name: "sfmc-module-catalog",
    async beforeBuild() {
      mkdirSync(path.dirname(opts.outFile), { recursive: true });
      const { data, source } = await readIndex(opts);
      const registry = toRegistry(data, source);
      registryJson = JSON.stringify(registry, null, 2) + "\n";
      writeFileSync(opts.outFile, registryJson, "utf8");
      // 首次无 fallback 时写入，便于离线 CI
      if (!existsSync(opts.fallbackFile) && registry.modules.length > 0) {
        writeFileSync(opts.fallbackFile, registryJson, "utf8");
      }
    },
    addRuntimeModules() {
      let json = registryJson;
      if (!json || json === '{"version":1,"modules":[]}') {
        if (existsSync(opts.outFile)) {
          json = readFileSync(opts.outFile, "utf8");
        } else if (existsSync(opts.fallbackFile)) {
          json = readFileSync(opts.fallbackFile, "utf8");
        } else {
          json = '{"version":1,"source":"empty","modules":[]}';
        }
      }
      return {
        "virtual-sfmc-module-registry": `export default ${json}`,
      };
    },
  };
}

/** 开发时若尚未跑 beforeBuild，从 fallback 复制 */
export function ensureFallbackCopied(opts: ModuleCatalogOptions) {
  if (!existsSync(opts.outFile) && existsSync(opts.fallbackFile)) {
    mkdirSync(path.dirname(opts.outFile), { recursive: true });
    copyFileSync(opts.fallbackFile, opts.outFile);
  }
}
