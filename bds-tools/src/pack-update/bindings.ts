/**
 * packs/pack-sources.json — 世界包远程源绑定
 */
import { withConfigSchema } from "@sfmc-bds/sdk/node/config";
import fs from "node:fs";
import path from "node:path";
import type { PackUpdateDeps } from "./deps.js";
import type { PackSourceBinding, PackSourcesFile } from "./types.js";

export function createPackUpdateBindingsApi(deps: Pick<PackUpdateDeps, "rootDir">) {
  const { rootDir } = deps;

  function packSourcesPath(): string {
    return path.join(rootDir, "packs", "pack-sources.json");
  }

  function readPackSources(): PackSourcesFile {
    const file = packSourcesPath();
    if (!fs.existsSync(file)) return { bindings: {} };
    try {
      const raw = JSON.parse(fs.readFileSync(file, "utf8")) as PackSourcesFile & { $schema?: string };
      return { bindings: raw.bindings ?? {} };
    } catch {
      return { bindings: {} };
    }
  }

  function writePackSources(data: PackSourcesFile): void {
    const file = packSourcesPath();
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const body = withConfigSchema({ bindings: data.bindings ?? {} }, "pack_sources", "packs");
    fs.writeFileSync(file, `${JSON.stringify(body, null, 2)}\n`, "utf8");
  }

  function getBinding(bpUuid: string): PackSourceBinding | null {
    const all = readPackSources();
    return all.bindings[bpUuid.toLowerCase()] ?? all.bindings[bpUuid] ?? null;
  }

  function setBinding(bpUuid: string, binding: PackSourceBinding): void {
    const all = readPackSources();
    const key = bpUuid.toLowerCase();
    /* 清理旧大小写键 */
    for (const k of Object.keys(all.bindings)) {
      if (k.toLowerCase() === key) delete all.bindings[k];
    }
    all.bindings[key] = binding;
    writePackSources(all);
  }

  function removeBinding(bpUuid: string): boolean {
    const all = readPackSources();
    const key = bpUuid.toLowerCase();
    let removed = false;
    for (const k of Object.keys(all.bindings)) {
      if (k.toLowerCase() === key) {
        delete all.bindings[k];
        removed = true;
      }
    }
    if (removed) writePackSources(all);
    return removed;
  }

  function listBindings(): Array<{ bpUuid: string; binding: PackSourceBinding }> {
    const all = readPackSources();
    return Object.entries(all.bindings).map(([bpUuid, binding]) => ({ bpUuid, binding }));
  }

  return {
    packSourcesPath,
    readPackSources,
    writePackSources,
    getBinding,
    setBinding,
    removeBinding,
    listBindings,
  };
}

export type PackUpdateBindingsApi = ReturnType<typeof createPackUpdateBindingsApi>;
