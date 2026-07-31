/**
 * Playground JSON-RPC 宿主（stdio 行协议）。
 * 启动：node --import @sfmc-bds/sdk/testing/minecraft-loader --import tsx/esm <本文件>
 *
 * 请求：meta / start(=重置) / stop / objects.* / events.* / tick / scene.summary / smoke.run
 * 通知：{"type":"event","name":"progress"|"log","payload":...}
 * UI 开面板即 start；无启动/销毁主按钮。
 *
 * 环境变量 SFMC_PLAYGROUND_MODULE_ROOT：默认模块根（可被 start.params.moduleRoot 覆盖）。
 */

import readline from "node:readline";
import { Command } from "@sfmc-bds/sdk/sapi/runtime";
import { createSandbox, type Sandbox } from "./sandbox.js";
import { PLAYGROUND_META } from "./engine/generated/playground-meta.js";

type RpcReq = { id: number | string; method: string; params?: Record<string, unknown> };

let sb: Sandbox | null = null;
type LastEmitSnap = {
  path: string;
  at: number;
  /** 调用方原始 payload（保留 $ref） */
  payload: unknown;
  /** emit 后事件对象摘要（含 cancel 等） */
  result: unknown;
  /** 同步调用的订阅回调数 */
  listeners: number;
  /** 订阅回调同步抛错摘要 */
  errors: { message: string }[];
};
type LastCallSnap = {
  id: string;
  method: string;
  result: unknown;
  at: number;
};
let lastEmit: LastEmitSnap | null = null;
let lastCall: LastCallSnap | null = null;
let activeModuleRoot: string | null = null;

/** 规范化为可 JSON 断言的摘要（深度有限） */
function snapshotValue(value: unknown, depth = 0): unknown {
  if (depth > 4) return "[…]";
  if (value == null) return value;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (typeof value === "function") return "[Function]";
  if (Array.isArray(value)) {
    return value.slice(0, 32).map((v) => snapshotValue(v, depth + 1));
  }
  if (typeof value === "object") {
    const o = value as Record<string, unknown>;
    if (typeof o.$ref === "string") return { $ref: o.$ref };
    if (typeof o.id === "string" && typeof o.name === "string") {
      return { $refHint: o.id, name: o.name };
    }
    if (typeof o.id === "string" && typeof o.typeId === "string") {
      return { $refHint: o.id, typeId: o.typeId };
    }
    if (typeof o.x === "number" && typeof o.y === "number" && typeof o.z === "number") {
      return { x: o.x, y: o.y, z: o.z };
    }
    const out: Record<string, unknown> = {};
    let n = 0;
    for (const [k, v] of Object.entries(o)) {
      if (n++ >= 40) {
        out["…"] = "truncated";
        break;
      }
      try {
        out[k] = snapshotValue(v, depth + 1);
      } catch {
        out[k] = String(v);
      }
    }
    return out;
  }
  return String(value);
}

function notify(name: string, payload: unknown): void {
  process.stdout.write(`${JSON.stringify({ type: "event", name, payload })}\n`);
}

function reply(id: number | string, result: unknown): void {
  process.stdout.write(`${JSON.stringify({ id, result })}\n`);
}

function replyError(id: number | string, message: string): void {
  process.stdout.write(`${JSON.stringify({ id, error: { message } })}\n`);
}

function resolveModuleRoot(params: Record<string, unknown>): string | undefined {
  const fromParams = typeof params.moduleRoot === "string" ? params.moduleRoot.trim() : "";
  if (fromParams) return fromParams;
  const fromEnv = (process.env.SFMC_PLAYGROUND_MODULE_ROOT || "").trim();
  return fromEnv || undefined;
}

async function flushCommandSideEffects(): Promise<void> {
  if (!sb) return;
  sb.flush();
  await Promise.resolve();
  sb.flush();
  await Promise.resolve();
  sb.flush();
}

/** 对已注册命令走 !name + chatSend（禁止扩展直接 triggerCommand 作手点主路径）。 */
async function runSmoke(moduleId: string | null): Promise<{
  ok: boolean;
  module: string | null;
  commands: string[];
  results: { name: string; ok: boolean; log: string[] }[];
}> {
  if (!sb) throw new Error("sandbox not started");
  const player = sb.addPlayer({ name: "smoke", op: true });
  const names = Command.names().filter((n) => {
    if (n === "help") return false;
    if (!moduleId) return true;
    const mid = Command.getModuleId(n);
    // 未标注 moduleId 的命令在单模块沙箱里一并冒烟
    return mid === undefined || mid === moduleId;
  });
  const results: { name: string; ok: boolean; log: string[] }[] = [];
  for (const name of names) {
    const before = player.log.length;
    sb.emit.chatSend(player, `!${name}`);
    await flushCommandSideEffects();
    const log = player.log.slice(before);
    const failed = log.some((line) => line.includes("§c[x]") || line.includes("未知的命令"));
    results.push({ name, ok: !failed, log });
    notify("log", {
      channel: "system",
      text: `[smoke] !${name} → ${failed ? "FAIL" : "ok"}`,
    });
  }
  return {
    ok: results.every((r) => r.ok),
    module: moduleId,
    commands: names,
    results,
  };
}

async function handle(req: RpcReq): Promise<unknown> {
  const { method, params = {} } = req;
  switch (method) {
    case "meta":
      return PLAYGROUND_META;
    case "ping":
      return { ok: true };
    case "start": {
      if (sb) await sb.dispose();
      lastEmit = null;
      lastCall = null;
      const moduleRoot = resolveModuleRoot(params);
      activeModuleRoot = moduleRoot ?? null;
      sb = await createSandbox({
        ...(moduleRoot ? { moduleRoot } : {}),
        onProgress(step) {
          notify("progress", { phase: "start", ...step });
        },
      });
      const modLabel = sb.module?.id ?? "(engine only)";
      notify("log", {
        channel: "system",
        text: moduleRoot
          ? `[playground] sandbox started module=${modLabel} root=${moduleRoot}`
          : "[playground] sandbox started (engine only)",
      });
      return {
        ok: true,
        module: sb.module,
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
        lastEmit = null;
        lastCall = null;
        activeModuleRoot = null;
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
    case "objects.inspect": {
      if (!sb) throw new Error("sandbox not started");
      return sb.objects.inspect(String(params.id ?? ""));
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
      const resultSnap = snapshotValue(result);
      lastCall = { id, method: methodName, result: resultSnap, at: Date.now() };
      notify("log", {
        channel: "system",
        text: `[objects] call ${id}.${methodName}(${args.length} args)`,
      });
      return { result: resultSnap };
    }
    case "events.paths": {
      if (!sb) throw new Error("sandbox not started");
      return sb.events.paths();
    }
    case "events.emit": {
      if (!sb) throw new Error("sandbox not started");
      const path = String(params.path ?? "");
      const payload = params.payload ?? {};
      const eventObj = sb.events.emit(path, payload);
      const meta = sb.events.lastMeta();
      const listeners = meta?.listeners ?? 0;
      const errors = (meta?.errors ?? []).map((e) => ({ message: e.message }));
      lastEmit = {
        path,
        at: Date.now(),
        payload: snapshotValue(payload),
        result: snapshotValue(eventObj),
        listeners,
        errors,
      };
      notify("log", {
        channel: "system",
        text: `[events] emit ${path} → ${listeners} listener(s)`,
      });
      for (const err of errors) {
        notify("log", {
          channel: "system",
          text: `[events] listener error: ${err.message}`,
        });
      }
      return {
        ok: true,
        path,
        payload: lastEmit.payload,
        result: lastEmit.result,
        listeners,
        errors,
      };
    }
    case "events.listenerCount": {
      if (!sb) throw new Error("sandbox not started");
      const path = String(params.path ?? "");
      return { path, listeners: sb.events.listenerCount(path) };
    }
    case "events.eventType": {
      if (!sb) throw new Error("sandbox not started");
      return { eventType: sb.events.eventType(String(params.path ?? "")) ?? null };
    }
    case "scene.summary": {
      if (!sb) throw new Error("sandbox not started");
      const scene = sb.objects.sceneNodes();
      return {
        started: true,
        ...scene,
        playerCount: scene.players.length,
        objectCount: sb.objects.list().length,
        eventPathCount: sb.events.paths().length,
        lastEmit,
        lastCall,
        module: sb.module?.id ?? null,
        moduleRoot: activeModuleRoot,
        note: sb.module ? `module=${sb.module.id}` : "engine only",
      };
    }
    case "tick": {
      if (!sb) throw new Error("sandbox not started");
      const n = typeof params.n === "number" ? params.n : 1;
      sb.tick(n);
      return { ok: true, n };
    }
    case "smoke.run": {
      return runSmoke(sb?.module?.id ?? null);
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
