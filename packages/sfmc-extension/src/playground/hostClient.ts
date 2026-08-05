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

export type HostEntry = {
  loaderFs: string;
  hostFs: string;
  loaderUrl: string;
  /** tsx/esm 的 file URL；解析失败则为 null（回退 strip-types） */
  tsxUrl: string | null;
  sdkRoot: string;
};

/** 解析 playground-host / minecraft-loader / tsx（供 spawn 与启动并调试共用）。 */
export function resolveHostEntry(): HostEntry {
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
  let tsxUrl: string | null = null;
  try {
    tsxUrl = pathToFileURL(require.resolve("tsx/esm")).href;
  } catch {
    try {
      const fromRoot = path.resolve(root, "../../../node_modules/tsx/dist/esm/index.mjs");
      if (fs.existsSync(fromRoot)) tsxUrl = pathToFileURL(fromRoot).href;
    } catch {
      /* 回退 --experimental-strip-types */
    }
  }
  return {
    loaderFs,
    hostFs,
    loaderUrl: pathToFileURL(loaderFs).href,
    tsxUrl,
    sdkRoot: root,
  };
}

/** 构造启动 playground-host 的 node argv（不含 execPath）。 */
export function buildHostNodeArgs(entry: HostEntry = resolveHostEntry()): string[] {
  const args = ["--import", entry.loaderUrl];
  if (entry.tsxUrl) {
    args.push("--import", entry.tsxUrl);
  } else {
    args.push("--experimental-strip-types");
  }
  args.push(entry.hostFs);
  return args;
}

export class PlaygroundHostClient {
  private proc: ChildProcessWithoutNullStreams | null = null;
  private nextId = 1;
  private pending = new Map<number, Pending>();
  private onEvent: (ev: PlaygroundEvent) => void;
  private moduleRoot?: string;

  constructor(onEvent: (ev: PlaygroundEvent) => void, moduleRoot?: string) {
    this.onEvent = onEvent;
    this.moduleRoot = moduleRoot;
  }

  startProcess(): void {
    if (this.proc) return;
    const entry = resolveHostEntry();
    if (!fs.existsSync(entry.hostFs)) {
      throw new Error(`playground-host 未构建: ${entry.hostFs}`);
    }
    if (!fs.existsSync(entry.loaderFs)) {
      throw new Error(`minecraft-loader 未构建: ${entry.loaderFs}`);
    }
    const env = { ...process.env };
    if (this.moduleRoot) {
      env.SFMC_PLAYGROUND_MODULE_ROOT = this.moduleRoot;
    }
    const proc = spawn(process.execPath, buildHostNodeArgs(entry), {
      stdio: ["pipe", "pipe", "pipe"],
      env,
      cwd: this.moduleRoot || undefined,
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
