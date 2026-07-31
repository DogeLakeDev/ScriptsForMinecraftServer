/**
 * 解析并 spawn sfmc CLI。
 * CLI 与 SFMC 工作目录无关：从本包/扩展安装树、PATH 或显式配置解析；
 * 工作目录只作为 spawn 的 cwd 与 SFMC_ROOT。
 */

import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isValidSfmcRoot } from "./sfmc-root.js";

/** chalk.hex("#e06c75") 的真彩序列；CLI 失败文案经 c.red() 包装。 */
const CLI_ANSI_RED = "\u001b[38;2;224;108;117m";

export interface ResolveSfmcCliOptions {
  /** 显式 CLI 入口（.js/.mjs）；也可用环境变量 SFMC_CLI。 */
  cliPath?: string;
}

function tryRequireCli(from: string): string | null {
  try {
    const resolved = createRequire(from).resolve("@sfmc-bds/cli/cli");
    return fs.existsSync(resolved) ? resolved : null;
  } catch {
    return null;
  }
}

/** 自 PATH 上的 sfmc 可执行文件旁解析 @sfmc-bds/cli（npm global / 本地 .bin）。 */
function resolveCliFromPathEnv(): string | null {
  const pathEnv = process.env.PATH ?? "";
  const names =
    process.platform === "win32" ? ["sfmc.cmd", "sfmc.exe", "sfmc.ps1", "sfmc"] : ["sfmc"];
  for (const dir of pathEnv.split(path.delimiter)) {
    if (!dir) continue;
    let hit = false;
    for (const name of names) {
      if (fs.existsSync(path.join(dir, name))) {
        hit = true;
        break;
      }
    }
    if (!hit) continue;
    const nearCli = path.join(dir, "..", "@sfmc-bds", "cli", "dist", "main.js");
    if (fs.existsSync(nearCli)) return nearCli;
    const nearMeta = path.join(dir, "..", "@sfmc-bds", "sfmc", "bin", "sfmc.mjs");
    if (fs.existsSync(nearMeta)) return nearMeta;
    const fromBin = tryRequireCli(path.join(dir, "..", "package.json"));
    if (fromBin) return fromBin;
  }
  return null;
}

/**
 * 解析 sfmc CLI 脚本路径。
 * 顺序：显式 cliPath / SFMC_CLI → 本包安装树（@sfmc-bds/cli）→ cwd 的 node_modules → PATH。
 */
export function resolveSfmcCli(opts: ResolveSfmcCliOptions = {}): string {
  const explicit = (opts.cliPath || process.env.SFMC_CLI || "").trim();
  if (explicit) {
    const p = path.resolve(explicit);
    if (!fs.existsSync(p)) {
      throw new Error(`指定的 sfmc CLI 不存在：${p}（检查 SFMC_CLI / sfmc.cliPath）`);
    }
    return p;
  }

  const here = fileURLToPath(import.meta.url);
  const fromInstall = tryRequireCli(here);
  if (fromInstall) return fromInstall;

  const fromCwd = tryRequireCli(path.join(process.cwd(), "package.json"));
  if (fromCwd) return fromCwd;

  const fromPath = resolveCliFromPathEnv();
  if (fromPath) return fromPath;

  throw new Error(
    "无法解析 sfmc CLI。请安装 @sfmc-bds/cli（或确保 PATH 上有 sfmc），或设置环境变量 SFMC_CLI / 扩展配置 sfmc.cliPath。"
  );
}

function looksLikeCliFailure(output: string): boolean {
  if (output.includes(CLI_ANSI_RED)) return true;
  if (/\[pack-manager\].*required/.test(output)) return true;
  if (/^Error:/m.test(output)) return true;
  return false;
}

export interface RunSfmcCliResult {
  ok: boolean;
  output: string;
}

export interface RunSfmcCliOptions {
  cliPath?: string;
}

/** 在 SFMC 工作目录下执行 `node <sfmc-cli> ...args`（env.SFMC_ROOT = 工作目录）。 */
export async function runSfmcCli(
  sfmcRoot: string,
  args: string[],
  opts: RunSfmcCliOptions = {}
): Promise<RunSfmcCliResult> {
  const root = path.resolve(sfmcRoot);
  if (!isValidSfmcRoot(root)) {
    return {
      ok: false,
      output: `无效的 SFMC 工作目录：${root}（需要含 configs/ 与 modules/，不必含源码仓库）`,
    };
  }

  let script: string;
  try {
    script = resolveSfmcCli({ cliPath: opts.cliPath });
  } catch (e) {
    return { ok: false, output: e instanceof Error ? e.message : String(e) };
  }

  const r = await new Promise<{ code: number | null; output: string }>((resolve) => {
    const proc = spawn(process.execPath, [script, ...args], {
      cwd: root,
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, SFMC_ROOT: root },
    });
    let out = "";
    proc.stdout?.on("data", (d) => {
      out += d.toString();
    });
    proc.stderr?.on("data", (d) => {
      out += d.toString();
    });
    proc.on("exit", (code) => resolve({ code, output: out }));
    proc.on("error", (e) => resolve({ code: 1, output: e.message }));
  });

  const ok = r.code === 0 && !looksLikeCliFailure(r.output);
  return { ok, output: r.output };
}
