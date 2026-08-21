/**
 * 脚手架：委托 @sfmc-bds/devkit/scripts/new-module.mjs。
 */

import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { findMonorepoRoot } from "@sfmc-bds/sdk/node/config";

export interface ScaffoldOptions {
  /** 目标目录（须为空或可创建）。 */
  targetDir: string;
  moduleId: string;
  displayName?: string;
  official?: boolean;
}

function resolveNewModuleScript(): string {
  const require = createRequire(import.meta.url);
  try {
    return require.resolve("@sfmc-bds/devkit/new-module.mjs");
  } catch {
    /* monorepo 回退 */
  }
  const monoRoot = findMonorepoRoot(process.cwd());
  const mono = monoRoot
    ? path.join(monoRoot, "packages", "devkit", "scripts", "new-module.mjs")
    : path.resolve(process.cwd(), "packages/devkit/scripts/new-module.mjs");
  if (fs.existsSync(mono)) return mono;
  throw new Error("无法解析 new-module.mjs（安装 @sfmc-bds/devkit 或在 monorepo 根运行）");
}

export async function scaffoldModule(opts: ScaffoldOptions): Promise<{ ok: boolean; message: string }> {
  const dir = path.resolve(opts.targetDir);
  fs.mkdirSync(dir, { recursive: true });
  const script = resolveNewModuleScript();
  const args = [script, opts.moduleId];
  if (opts.displayName) args.push("--name", opts.displayName);
  if (opts.official) args.push("--official");

  return new Promise((resolve) => {
    const proc = spawn(process.execPath, args, {
      cwd: dir,
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env,
    });
    let out = "";
    proc.stdout?.on("data", (d) => {
      out += d.toString();
    });
    proc.stderr?.on("data", (d) => {
      out += d.toString();
    });
    proc.on("exit", (code) => {
      resolve({
        ok: code === 0,
        message: out.trim() || (code === 0 ? `scaffolded ${opts.moduleId}` : `exit ${code}`),
      });
    });
    proc.on("error", (e) => resolve({ ok: false, message: e.message }));
  });
}
