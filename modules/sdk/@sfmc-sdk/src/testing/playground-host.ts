/**
 * Playground JSON-RPC 宿主（stdio 行协议）。
 * 启动：node --import @sfmc-bds/sdk/testing/minecraft-loader --import tsx/esm <本文件>
 *
 * 请求：meta / start(=重置) / stop / objects.* / events.* / tick / scene.summary /
 *       fixture.get / fixture.apply / smoke.run
 * 通知：{"type":"event","name":"progress"|"log","payload":...}
 * UI 开面板即 start；无启动/销毁主按钮。
 *
 * 环境变量 SFMC_PLAYGROUND_MODULE_ROOT：默认模块根（可被 start.params.moduleRoot 覆盖）。
 * 夹具意图在 start/reset 间保留，并随 createSandbox({ fixture }) 重新注入。
 */

import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { Command } from "@sfmc-bds/sdk/sapi/runtime";
import { ModuleRegistry } from "@sfmc-bds/sdk/module-loader";
import { createSandbox, type Sandbox } from "./sandbox.js";
import { PLAYGROUND_META } from "./engine/generated/playground-meta.js";
import {
  buildFixtureSnapshot,
  type SandboxFixtureIntent,
} from "./fixture.js";

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
/** 重置场景后保留的夹具意图。 */
let fixtureIntent: SandboxFixtureIntent = {};

function parseFixtureIntent(raw: unknown): SandboxFixtureIntent {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const o = raw as Record<string, unknown>;
  const intent: SandboxFixtureIntent = {};
  if (o.settings && typeof o.settings === "object" && !Array.isArray(o.settings)) {
    intent.settings = o.settings as Record<string, unknown>;
  }
  if (Array.isArray(o.permissions)) {
    intent.permissions = o.permissions
      .filter((p): p is { player_name: string; level: number } => {
        if (!p || typeof p !== "object") return false;
        const row = p as Record<string, unknown>;
        return typeof row.player_name === "string" && typeof row.level === "number";
      })
      .map((p) => ({ player_name: p.player_name, level: p.level }));
  }
  if (typeof o.treatPlayersAsOp === "boolean") intent.treatPlayersAsOp = o.treatPlayersAsOp;
  if (typeof o.enabled === "boolean") intent.enabled = o.enabled;
  if (typeof o.clearDb === "boolean") intent.clearDb = o.clearDb;
  return intent;
}

function mergeFixtureIntent(patch: SandboxFixtureIntent): SandboxFixtureIntent {
  const next: SandboxFixtureIntent = { ...fixtureIntent };
  if (patch.settings !== undefined) next.settings = structuredClone(patch.settings);
  if (patch.permissions !== undefined) next.permissions = structuredClone(patch.permissions);
  if (patch.treatPlayersAsOp !== undefined) next.treatPlayersAsOp = patch.treatPlayersAsOp;
  if (patch.enabled !== undefined) next.enabled = patch.enabled;
  if (patch.clearDb !== undefined) next.clearDb = patch.clearDb;
  fixtureIntent = next;
  return next;
}

function fixtureSnapshot() {
  if (!sb) throw new Error("sandbox not started");
  const id = sb.module?.id ?? null;
  return buildFixtureSnapshot({
    module: sb.module,
    moduleRoot: activeModuleRoot,
    enabled: id ? ModuleRegistry.isActive(id) : null,
    adapter: sb.configAdapter,
    intent: fixtureIntent,
    db: sb.db,
  });
}

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

/** 读模块 package.json version（DESCRIPTOR 无 version 字段）。 */
function readPackageVersion(moduleRoot: string): string | undefined {
  try {
    const raw = fs.readFileSync(path.join(moduleRoot, "package.json"), "utf8");
    const pkg = JSON.parse(raw) as { version?: unknown };
    return typeof pkg.version === "string" && pkg.version.trim() ? pkg.version.trim() : undefined;
  } catch {
    return undefined;
  }
}

/** boot 后模块绑定摘要（供 Webview / Output 对账「装的就是我的模块」）。 */
function buildModuleBinding(sb: Sandbox, moduleRoot: string | null) {
  const subscribed = sb.events.subscribedPaths();
  const id = sb.module?.id ?? null;
  const version = moduleRoot ? readPackageVersion(moduleRoot) : undefined;
  const enabled = id ? ModuleRegistry.isActive(id) : null;
  const desc = id ? ModuleRegistry.get(id) : undefined;
  return {
    moduleRoot,
    id,
    version: version ?? null,
    enabled,
    afterWorldLoad: desc?.afterWorldLoad ?? null,
    status: id ? ("loaded" as const) : ("engine-only" as const),
    subscribedEvents: subscribed,
    eventNote: id
      ? "事件由模块 registerEvents 注册（含宿主 chat→命令桥等）"
      : "engine only：无模块 registerEvents",
  };
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
      // start.params.fixture 可覆盖保留意图；缺省沿用上次 fixtureIntent
      if (params.fixture !== undefined) {
        mergeFixtureIntent(parseFixtureIntent(params.fixture));
      }
      if (params.clearFixture === true) {
        fixtureIntent = {};
      }
      const hasFixture =
        fixtureIntent.settings !== undefined ||
        fixtureIntent.permissions !== undefined ||
        fixtureIntent.treatPlayersAsOp !== undefined ||
        fixtureIntent.enabled !== undefined ||
        fixtureIntent.clearDb === true;
      sb = await createSandbox({
        ...(moduleRoot ? { moduleRoot } : {}),
        ...(hasFixture ? { fixture: { ...fixtureIntent, clearDb: false } } : {}),
        onProgress(step) {
          notify("progress", { phase: "start", ...step });
        },
      });
      if (fixtureIntent.treatPlayersAsOp || fixtureIntent.clearDb) {
        const post: SandboxFixtureIntent = {};
        if (fixtureIntent.treatPlayersAsOp) post.treatPlayersAsOp = true;
        if (fixtureIntent.clearDb) post.clearDb = true;
        await sb.applyFixture(post);
      }
      const binding = buildModuleBinding(sb, moduleRoot ?? null);
      const modLabel = binding.id ?? "(engine only)";
      const subSummary =
        binding.subscribedEvents.length > 0
          ? binding.subscribedEvents.map((e) => `${e.path}×${e.listeners}`).join(", ")
          : "(无已订阅 path)";
      notify("log", {
        channel: "system",
        text: moduleRoot
          ? `[playground] sandbox started module=${modLabel} version=${binding.version ?? "?"} enabled=${binding.enabled} root=${moduleRoot}`
          : "[playground] sandbox started (engine only)",
      });
      notify("log", {
        channel: "system",
        text: `[playground] ${binding.eventNote}；subscribed=[${subSummary}]`,
      });
      return {
        ok: true,
        module: sb.module
          ? {
              id: sb.module.id,
              root: sb.module.root ?? moduleRoot ?? undefined,
              version: binding.version,
              enabled: binding.enabled,
              afterWorldLoad: binding.afterWorldLoad,
            }
          : null,
        moduleRoot: binding.moduleRoot,
        moduleBinding: binding,
        subscribedEvents: binding.subscribedEvents,
        objectKinds: sb.objects.kinds(),
        eventPathCount: sb.events.paths().length,
        fixture: fixtureSnapshot(),
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
    case "events.subscribed": {
      if (!sb) throw new Error("sandbox not started");
      return sb.events.subscribedPaths();
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
      const binding = buildModuleBinding(sb, activeModuleRoot);
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
        moduleBinding: binding,
        subscribedEvents: binding.subscribedEvents,
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
    case "fixture.get": {
      return fixtureSnapshot();
    }
    case "fixture.apply": {
      if (!sb) throw new Error("sandbox not started");
      const patch = parseFixtureIntent(params.fixture ?? params);
      const merged = mergeFixtureIntent(patch);
      await sb.applyFixture(merged);
      notify("log", {
        channel: "system",
        text: `[fixture] applied settings=${Object.keys(merged.settings ?? {}).length} perms=${(merged.permissions ?? []).length} op=${!!merged.treatPlayersAsOp} enabled=${merged.enabled ?? "—"} clearDb=${!!merged.clearDb}`,
      });
      return fixtureSnapshot();
    }
    case "fixture.clearDb": {
      if (!sb) throw new Error("sandbox not started");
      sb.clearDb();
      notify("log", { channel: "system", text: "[fixture] fake-db call log cleared" });
      return fixtureSnapshot();
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
