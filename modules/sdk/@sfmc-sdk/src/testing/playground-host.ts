/**
 * Playground JSON-RPC 宿主（stdio 行协议）。
 * 启动：node --import @sfmc-bds/sdk/testing/minecraft-loader <本文件>
 *
 * 请求：{"id":1,"method":"meta"} / objects.create / objects.call / events.emit / tick / start / stop
 * 通知：{"type":"event","name":"progress"|"log","payload":...}
 */

import readline from "node:readline";
import { createSandbox, type Sandbox } from "./sandbox.js";
import { PLAYGROUND_META } from "./engine/generated/playground-meta.js";

type RpcReq = { id: number | string; method: string; params?: Record<string, unknown> };

let sb: Sandbox | null = null;

function notify(name: string, payload: unknown): void {
  process.stdout.write(`${JSON.stringify({ type: "event", name, payload })}\n`);
}

function reply(id: number | string, result: unknown): void {
  process.stdout.write(`${JSON.stringify({ id, result })}\n`);
}

function replyError(id: number | string, message: string): void {
  process.stdout.write(`${JSON.stringify({ id, error: { message } })}\n`);
}

const PROGRESS_START = [
  { id: 0, layer: "native", label: "装载脚本入口（early）" },
  { id: 1, layer: "native", label: "加载 System" },
  { id: 2, layer: "native", label: "加载 World 壳" },
  { id: 3, layer: "native", label: "绑定 @minecraft 表面" },
  { id: 4, layer: "native", label: "system.beforeEvents.startup" },
  { id: 5, layer: "sfmc", label: "ConfigManager.init" },
  { id: 6, layer: "sfmc", label: "ModuleRegistry.bootAll" },
  { id: 7, layer: "sfmc", label: "snapshotEnabled" },
  { id: 8, layer: "native", label: "（等待世界就绪）" },
  { id: 9, layer: "native", label: "Dimension 默认可查询" },
  { id: 10, layer: "native", label: "world.afterEvents.worldLoad" },
  { id: 11, layer: "sfmc", label: "bootAfterWorldLoad" },
  { id: 12, layer: "ready", label: "就绪" },
] as const;

async function handle(req: RpcReq): Promise<unknown> {
  const { method, params = {} } = req;
  switch (method) {
    case "meta":
      return PLAYGROUND_META;
    case "ping":
      return { ok: true };
    case "start": {
      if (sb) await sb.dispose();
      for (const step of PROGRESS_START) {
        notify("progress", { phase: "start", ...step, status: "running" });
      }
      sb = await createSandbox({});
      notify("log", { channel: "system", text: "[playground] sandbox started (engine only)" });
      for (const step of PROGRESS_START) {
        notify("progress", { phase: "start", ...step, status: "done" });
      }
      return {
        ok: true,
        objectKinds: sb.objects.kinds(),
        eventPathCount: sb.events.paths().length,
      };
    }
    case "stop": {
      if (sb) {
        notify("progress", {
          phase: "stop",
          id: 1,
          layer: "native",
          label: "system.beforeEvents.shutdown",
          status: "running",
        });
        await sb.dispose();
        sb = null;
        notify("progress", {
          phase: "stop",
          id: 1,
          layer: "native",
          label: "system.beforeEvents.shutdown",
          status: "done",
        });
        notify("log", { channel: "system", text: "[playground] sandbox disposed" });
      }
      return { ok: true };
    }
    case "objects.list": {
      if (!sb) throw new Error("sandbox not started");
      return sb.objects.list().map((h) => ({ id: h.id, kind: h.kind }));
    }
    case "objects.create": {
      if (!sb) throw new Error("sandbox not started");
      const kind = String(params.kind ?? "");
      const props = (params.props as Record<string, unknown>) ?? {};
      const h = sb.objects.create(kind, props);
      notify("log", { channel: "system", text: `[objects] create ${h.kind} ${h.id}` });
      return { id: h.id, kind: h.kind };
    }
    case "objects.call": {
      if (!sb) throw new Error("sandbox not started");
      const id = String(params.id ?? "");
      const methodName = String(params.method ?? "");
      const args = Array.isArray(params.args) ? params.args : [];
      const result = sb.objects.call(id, methodName, args);
      notify("log", {
        channel: "system",
        text: `[objects] call ${id}.${methodName}(${args.length} args)`,
      });
      return { result: result === undefined ? null : String(result) };
    }
    case "events.paths": {
      if (!sb) throw new Error("sandbox not started");
      return sb.events.paths();
    }
    case "events.emit": {
      if (!sb) throw new Error("sandbox not started");
      const path = String(params.path ?? "");
      const payload = params.payload ?? {};
      sb.events.emit(path, payload);
      notify("log", { channel: "system", text: `[events] emit ${path}` });
      return { ok: true };
    }
    case "events.eventType": {
      if (!sb) throw new Error("sandbox not started");
      return { eventType: sb.events.eventType(String(params.path ?? "")) ?? null };
    }
    case "tick": {
      if (!sb) throw new Error("sandbox not started");
      const n = typeof params.n === "number" ? params.n : 1;
      sb.tick(n);
      return { ok: true, n };
    }
    default:
      throw new Error(`unknown method: ${method}`);
  }
}

async function main(): Promise<void> {
  notify("log", { channel: "system", text: "[playground-host] ready" });
  const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
  for await (const line of rl) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    let req: RpcReq;
    try {
      req = JSON.parse(trimmed) as RpcReq;
    } catch {
      notify("log", { channel: "system", text: `[playground-host] bad json: ${trimmed.slice(0, 80)}` });
      continue;
    }
    if (req.id === undefined || !req.method) continue;
    try {
      const result = await handle(req);
      reply(req.id, result);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      replyError(req.id, message);
      notify("log", { channel: "system", text: `[error] ${message}` });
    }
  }
  if (sb) await sb.dispose();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
