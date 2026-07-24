import {
  configPath,
  readJson,
  resolveRuntimeRoot,
  type RuntimeConfig,
} from "@sfmc-bds/sdk/node/config";
import { spawn, spawnSync, type SpawnOptions, type SpawnSyncOptions } from "node:child_process";
import { createRequire } from "node:module";
import fs from "node:fs";
import path, { dirname } from "node:path";
import process from "node:process";
import { isSea } from "node:sea";
import { fileURLToPath } from "node:url";

export const IS_SEA: boolean = typeof isSea === "function" && isSea();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const requireFromCli = createRequire(import.meta.url);

/**
 * 是否为 monorepo 布局(仓根同时有 db-server/ 与 sfmc/)。
 * npm 全局/本地安装时 ROOT 通常是 cwd,不满足此条件。
 */
export function isMonorepoLayout(root: string): boolean {
  return (
    fs.existsSync(path.join(root, "db-server", "package.json")) &&
    fs.existsSync(path.join(root, "sfmc", "package.json"))
  );
}

function detectFallbackRoot(): string {
  if (IS_SEA) return path.dirname(process.execPath);
  const monoCandidate = path.resolve(__dirname, "..", "..");
  if (isMonorepoLayout(monoCandidate)) return monoCandidate;
  /* npm 安装:@sfmc-bds/sfmc 包装器会设 SFMC_ROOT;裸跑 cli 时用 cwd 作数据根 */
  return process.cwd();
}

/**
 * 项目根目录。优先级:`process.env.SFMC_ROOT` > fallback。
 * - SEA:exe 所在目录
 * - monorepo:`sfmc/` 上一级
 * - npm 聚合包 / 全局安装:cwd(配置与数据落在当前目录)
 */
export const ROOT: string = resolveRuntimeRoot(detectFallbackRoot());

/**
 * 是否已完成首次向导初始化。
 * 以 `configs/runtime.json#initialized_at` 为准(wizard 写入);
 * 不再用「db_config.json 是否存在」——骨架由 ensureJsonConfig 在进程启动时创建。
 */
export function isRuntimeInitialized(root: string = ROOT): boolean {
  const runtime = readJson<RuntimeConfig>(configPath(root, "runtime.json"));
  return Boolean(runtime?.initialized_at);
}

export const PACKAGES_DIR: string = path.join(ROOT, "modules", "packages");

export type ServiceId = "db" | "qq" | "update" | "manager" | "pack-manager";

/** monorepo 相对 ROOT 的入口(开发布局) */
const SERVICE_SCRIPT: Record<ServiceId, string> = {
  db: "db-server/dist/index.js",
  qq: "qq-bridge/dist/index.js",
  update: "bds-tools/dist/check-update.js",
  manager: "bds-tools/dist/bds-manager.js",
  "pack-manager": "bds-tools/dist/cli-pack-manager.js",
};

/** 环境变量覆盖(由 @sfmc-bds/sfmc bin 注入) */
const SERVICE_ENV: Record<ServiceId, string> = {
  db: "SFMC_SERVICE_DB_ENTRY",
  qq: "SFMC_SERVICE_QQ_ENTRY",
  update: "SFMC_SERVICE_UPDATE_ENTRY",
  manager: "SFMC_SERVICE_MANAGER_ENTRY",
  "pack-manager": "SFMC_SERVICE_PACK_MANAGER_ENTRY",
};

/** npm 包解析回退 */
const SERVICE_NPM: Record<ServiceId, { pkg: string; exportPath?: string; rel?: string }> = {
  db: { pkg: "@sfmc-bds/db-server" },
  qq: { pkg: "@sfmc-bds/qq-bridge" },
  update: { pkg: "@sfmc-bds/bds-tools", exportPath: "@sfmc-bds/bds-tools/check-update", rel: "dist/check-update.js" },
  manager: { pkg: "@sfmc-bds/bds-tools", exportPath: "@sfmc-bds/bds-tools/bds-manager", rel: "dist/bds-manager.js" },
  "pack-manager": {
    pkg: "@sfmc-bds/bds-tools",
    exportPath: "@sfmc-bds/bds-tools/pack-manager",
    rel: "dist/cli-pack-manager.js",
  },
};

function tryResolveNpm(pkg: string, opts?: { exportPath?: string; rel?: string }): string | null {
  const attempts = [requireFromCli];
  try {
    attempts.push(createRequire(path.join(process.cwd(), "package.json")));
  } catch {
    /* cwd 无 package.json */
  }
  for (const req of attempts) {
    try {
      if (opts?.exportPath) return req.resolve(opts.exportPath);
      if (!opts?.rel) return req.resolve(pkg);
      const root = path.dirname(req.resolve(`${pkg}/package.json`));
      const full = path.join(root, opts.rel);
      if (fs.existsSync(full)) return full;
    } catch {
      /* try next */
    }
  }
  return null;
}

/**
 * 解析子服务入口脚本绝对路径。
 * 优先级: env 注入 > monorepo 相对 ROOT > npm 包 resolve。
 */
export function resolveServiceScript(service: ServiceId): string {
  const fromEnv = process.env[SERVICE_ENV[service]];
  if (fromEnv && fs.existsSync(fromEnv)) return fromEnv;

  const mono = path.join(ROOT, SERVICE_SCRIPT[service]);
  if (fs.existsSync(mono)) return mono;

  const { pkg, exportPath, rel } = SERVICE_NPM[service];
  const fromNpm = tryResolveNpm(pkg, {
    ...(exportPath ? { exportPath } : {}),
    ...(rel ? { rel } : {}),
  });
  if (fromNpm) return fromNpm;

  throw new Error(
    `Cannot resolve service "${service}". Install @sfmc-bds/sfmc (all-in-one) or run inside the monorepo. ` +
      `Looked for ${mono} and npm package ${pkg}.`
  );
}

/**
 * 解析 tools/fetch-module.mjs。
 * 优先级: SFMC_FETCH_MODULE > ROOT/tools/ > @sfmc-bds/tools。
 */
export function resolveFetchModule(): string | null {
  const fromEnv = process.env.SFMC_FETCH_MODULE;
  if (fromEnv && fs.existsSync(fromEnv)) return fromEnv;

  const mono = path.join(ROOT, "tools", "fetch-module.mjs");
  if (fs.existsSync(mono)) return mono;

  return tryResolveNpm("@sfmc-bds/tools", { rel: "fetch-module.mjs", exportPath: "@sfmc-bds/tools/fetch-module.mjs" });
}

/**
 * 解析 tools/new-module.mjs。
 * 优先级: SFMC_NEW_MODULE > ROOT/tools/ > @sfmc-bds/tools。
 */
export function resolveNewModule(): string | null {
  const fromEnv = process.env.SFMC_NEW_MODULE;
  if (fromEnv && fs.existsSync(fromEnv)) return fromEnv;

  const mono = path.join(ROOT, "tools", "new-module.mjs");
  if (fs.existsSync(mono)) return mono;

  return tryResolveNpm("@sfmc-bds/tools", { rel: "new-module.mjs", exportPath: "@sfmc-bds/tools/new-module.mjs" });
}

/**
 * 解析 `@sfmc-bds/sdk` 包根目录（含 package.json）。
 * 优先级: SFMC_SDK_ROOT > createRequire(@sfmc-bds/sdk/package.json) > 公开 export 向上找 > monorepo。
 */
export function resolveSdkPackageRoot(): string {
  const fromEnv = process.env.SFMC_SDK_ROOT;
  if (fromEnv && fs.existsSync(path.join(fromEnv, "package.json"))) {
    return path.resolve(fromEnv);
  }

  function findSdkRootFromRequire(req: NodeRequire): string | null {
    try {
      // SDK 已暴露 ./package.json export；优先直解
      try {
        const pkgJson = req.resolve("@sfmc-bds/sdk/package.json");
        return path.dirname(pkgJson);
      } catch {
        /* 旧包未暴露时回退 */
      }
      // 任一公开 export 即可；再向上找含 name=@sfmc-bds/sdk 的 package.json
      const hit = req.resolve("@sfmc-bds/sdk/sapi/runtime");
      let dir = path.dirname(hit);
      for (let i = 0; i < 8; i++) {
        const cand = path.join(dir, "package.json");
        if (fs.existsSync(cand)) {
          try {
            const name = JSON.parse(fs.readFileSync(cand, "utf8")).name;
            if (name === "@sfmc-bds/sdk" || name === "@sfmc/sdk") return dir;
          } catch {
            /* continue */
          }
        }
        const parent = path.dirname(dir);
        if (parent === dir) break;
        dir = parent;
      }
    } catch {
      return null;
    }
    return null;
  }

  for (const req of [
    requireFromCli,
    (() => {
      try {
        return createRequire(path.join(process.cwd(), "package.json"));
      } catch {
        return null;
      }
    })(),
  ]) {
    if (!req) continue;
    const found = findSdkRootFromRequire(req);
    if (found) return found;
  }

  const mono = path.join(ROOT, "modules", "sdk", "@sfmc-sdk");
  if (fs.existsSync(path.join(mono, "package.json"))) return mono;

  // SFMC_ROOT 可能是数据目录；再试 monorepo 相对 CLI 的路径
  const fromCli = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "modules", "sdk", "@sfmc-sdk");
  if (fs.existsSync(path.join(fromCli, "package.json"))) return fromCli;

  throw new Error(
    `Cannot resolve @sfmc-bds/sdk for behavior-pack build. ` +
      `Install @sfmc-bds/sdk next to the CLI, set SFMC_SDK_ROOT, or run inside the monorepo.`
  );
}

/** 配置默认模板目录(聚合包装载 defaults/,或仓内 configs-default/) */
export function resolveDefaultsDir(): string | null {
  const fromEnv = process.env.SFMC_DEFAULTS_DIR;
  if (fromEnv && fs.existsSync(fromEnv)) return fromEnv;
  const bundled = path.join(ROOT, "configs-default");
  if (fs.existsSync(bundled)) return bundled;
  const nested = path.join(ROOT, "defaults");
  if (fs.existsSync(path.join(nested, "configs"))) return nested;
  return null;
}

/**
 * 将 configs-default（或 defaults/configs）中缺失的 *.json 播种到 configs/。
 * wizard 与 createServices 共用，避免各处手写拷贝（含 pack-update.json）。
 * @returns 本次新写入的文件名列表
 */
export function seedMissingConfigsFromDefaults(rootDir: string = ROOT): string[] {
  const defaultsDir = resolveDefaultsDir();
  if (!defaultsDir) return [];

  const src = fs.existsSync(path.join(defaultsDir, "configs"))
    ? path.join(defaultsDir, "configs")
    : defaultsDir;
  if (!fs.existsSync(src)) return [];

  const configsDest = path.join(rootDir, "configs");
  fs.mkdirSync(configsDest, { recursive: true });

  const written: string[] = [];
  for (const name of fs.readdirSync(src)) {
    if (!name.endsWith(".json")) continue;
    const dest = path.join(configsDest, name);
    if (fs.existsSync(dest)) continue;
    fs.copyFileSync(path.join(src, name), dest);
    written.push(name);
  }
  return written;
}

function nodeBinary(): string {
  return IS_SEA ? "node" : process.execPath;
}

function serviceChildEnv(service: ServiceId, optsEnv?: NodeJS.ProcessEnv | null) {
  return {
    ...process.env,
    ...optsEnv,
    SFMC_SERVICE: service,
    SFMC_ROOT: ROOT,
    SFMC_PACKAGES_DIR: PACKAGES_DIR,
  };
}

/**
 * 启动一个子服务。
 *
 * 透传给子进程的 env:
 *   - SFMC_SERVICE / SFMC_ROOT / SFMC_PACKAGES_DIR
 */
export function spawnService(service: ServiceId, args: string[] = [], opts: SpawnOptions = {}) {
  const env = serviceChildEnv(service, opts.env as NodeJS.ProcessEnv | undefined);
  const script = resolveServiceScript(service);
  return spawn(nodeBinary(), [script, ...args], { ...opts, env });
}

/** spawnService 的同步版本 */
export function spawnServiceSync(service: ServiceId, args: string[] = [], opts: SpawnSyncOptions = {}) {
  const env = serviceChildEnv(service, opts.env as NodeJS.ProcessEnv | undefined);
  const script = resolveServiceScript(service);
  return spawnSync(nodeBinary(), [script, ...args], { ...opts, env });
}
