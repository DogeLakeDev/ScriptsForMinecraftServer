/**
 * Playground 宿主进程客户端（JSON-RPC over stdin/stdout）
 */

import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createInterface } from "node:readline";
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

export type PlaygroundEvent = { name: string; payload: unknown };

type Pending = {
  resolve: (v: unknown) => void;
  reject: (e: Error) => void;
};

function resolveHostEntry(): { loaderFs: string; hostFs: string; loaderUrl: string } {
  const require = createRequire(__filename);
  let root: string | undefined;
  try {
    root = path.dirname(require.resolve("@sfmc-bds/sdk/package.json"));
  } catch {
    const candidate = path.resolve(__dirname, "../../../modules/sdk/@sfmc-sdk");
    if (fs.existsSync(path.join(candidate, "package.json"))) root = candidate;
  }
  if (!root) {
    throw new Error("找不到 @sfmc-bds/sdk；请在 monorepo 根 npm install 后重试");
  }
  const loaderFs = path.join(root, "dist/esm/testing/minecraft-loader.mjs");
  const hostFs = path.join(root, "dist/esm/testing/playground-host.js");
  // Windows 上 --import 必须用 file://，不能直接传 D:\...
  return {
    loaderFs,
    hostFs,
    loaderUrl: pathToFileURL(loaderFs).href,
  };
}

export class PlaygroundHostClient {
  private proc: ChildProcessWithoutNullStreams | null = null;
  private nextId = 1;
  private pending = new Map<number, Pending>();
  private onEvent: (ev: PlaygroundEvent) => void;

  constructor(onEvent: (ev: PlaygroundEvent) => void) {
    this.onEvent = onEvent;
  }

  startProcess(): void {
    if (this.proc) return;
    const { loaderFs, hostFs, loaderUrl } = resolveHostEntry();
    if (!fs.existsSync(hostFs)) {
      throw new Error(`playground-host 未构建: ${hostFs}`);
    }
    if (!fs.existsSync(loaderFs)) {
      throw new Error(`minecraft-loader 未构建: ${loaderFs}`);
    }
    const proc = spawn(process.execPath, ["--import", loaderUrl, hostFs], {
      stdio: ["pipe", "pipe", "pipe"],
      env: process.env,
    });
    this.proc = proc;
    const rl = createInterface({ input: proc.stdout });
    rl.on("line", (line) => this.onLine(line));
    proc.stderr.on("data", (buf) => {
      this.onEvent({ name: "log", payload: { channel: "system", text: buf.toString() } });
    });
    proc.on("exit", (code) => {
      this.proc = null;
      for (const [, p] of this.pending) p.reject(new Error(`host exited ${code}`));
      this.pending.clear();
      this.onEvent({ name: "log", payload: { channel: "system", text: `[host] exit ${code}` } });
    });
  }

  private onLine(line: string): void {
    let msg: Record<string, unknown>;
    try {
      msg = JSON.parse(line) as Record<string, unknown>;
    } catch {
      this.onEvent({ name: "log", payload: { channel: "system", text: line } });
      return;
    }
    if (msg.type === "event") {
      this.onEvent({ name: String(msg.name), payload: msg.payload });
      return;
    }
    const id = msg.id as number | undefined;
    if (id == null) return;
    const p = this.pending.get(id);
    if (!p) return;
    this.pending.delete(id);
    if (msg.error) {
      const err = msg.error as { message?: string };
      p.reject(new Error(err.message ?? "rpc error"));
    } else {
      p.resolve(msg.result);
    }
  }

  request(method: string, params: Record<string, unknown> = {}): Promise<unknown> {
    this.startProcess();
    const id = this.nextId++;
    const proc = this.proc;
    if (!proc) return Promise.reject(new Error("host not running"));
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      proc.stdin.write(`${JSON.stringify({ id, method, params })}\n`);
    });
  }

  dispose(): void {
    if (this.proc) {
      void this.request("stop").catch(() => undefined);
      this.proc.kill();
      this.proc = null;
    }
    this.pending.clear();
  }
}
