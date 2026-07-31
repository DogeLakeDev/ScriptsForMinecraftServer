/**
 * 组装并部署行为包：spawn bds-tools pack-manager（需 SFMC_ROOT）。
 */

import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";

export interface RebuildOptions {
  /** SFMC 工作根（含 configs/）。 */
  sfmcRoot: string;
  /** 仅构建不向 BDS 发 reload。 */
  buildOnly?: boolean;
}

export interface RebuildResult {
  ok: boolean;
  output: string;
}

function resolvePackManager(): string {
  const require = createRequire(import.meta.url);
  try {
    return require.resolve("@sfmc-bds/bds-tools/pack-manager");
  } catch {
    /* fallthrough */
  }
  const candidates = [
    path.resolve(process.cwd(), "bds-tools/dist/cli-pack-manager.js"),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  throw new Error("无法解析 pack-manager；请安装 @sfmc-bds/bds-tools 并设置 SFMC_ROOT");
}

export async function rebuildAndDeploy(opts: RebuildOptions): Promise<RebuildResult> {
  const root = path.resolve(opts.sfmcRoot);
  const script = resolvePackManager();
  const verbs = opts.buildOnly
    ? ["assemble-bp", "assemble-rp"]
    : ["assemble-bp", "assemble-rp", "deploy"];

  let output = "";
  for (const verb of verbs) {
    const r = await new Promise<{ code: number | null; output: string }>((resolve) => {
      const proc = spawn(process.execPath, [script, verb], {
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
    output += r.output;
    if (r.code !== 0) return { ok: false, output };
  }
  return { ok: true, output };
}
