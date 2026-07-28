/**
 * @sfmc-bds/sdk/testing — 模块 lifecycle 测试 harness
 *
 * 让模块在 `node --test` 中跑 registerPermissions / registerCommands /
 * registerEvents / init / cleanup，**不需**真实 BDS / db-server。
 *
 * 边界（OCP/LSP）：harness 不替换 SDK 内部 ConfigManager —— 模块若依赖
 * db/config/service，需在测试用例里自己 stub；本 harness 仅覆盖生命周期 + 消息断言。
 */
export type FakePlayer = {
  id: string;
  name: string;
  /** 调用 Msg.* 时收集到的全部消息（含前缀）。 */
  log: string[];
  /** mock sendMessage（Msg.* 内部调）。 */
  sendMessage(text: string): void;
};

export interface FakePlayerInit {
  id?: string;
  name: string;
}

export function createFakePlayer(init: FakePlayerInit): FakePlayer {
  const log: string[] = [];
  return {
    id: init.id ?? "0",
    name: init.name,
    log,
    sendMessage(text: string) {
      log.push(String(text ?? ""));
    },
  };
}

/**
 * Fake world / event bus。极简：仅记录订阅了哪些事件；
 * emit() 不强制约束订阅者接口。
 */
export interface FakeWorld {
  /** 事件名 → 处理器列表。 */
  listeners: Map<string, Array<(payload: unknown) => void>>;
  on(event: string, handler: (payload: unknown) => void): () => void;
  emit(event: string, payload?: unknown): void;
  reset(): void;
}

export function createFakeWorld(): FakeWorld {
  const listeners = new Map<string, Array<(payload: unknown) => void>>();
  return {
    listeners,
    on(event, handler) {
      const list = listeners.get(event) ?? [];
      list.push(handler);
      listeners.set(event, list);
      return () => {
        const arr = listeners.get(event);
        if (!arr) return;
        const idx = arr.indexOf(handler);
        if (idx >= 0) arr.splice(idx, 1);
      };
    },
    emit(event, payload) {
      const arr = listeners.get(event);
      if (!arr) return;
      for (const h of arr) {
        try {
          h(payload);
        } catch {
          /* 不让一个坏 handler 影响其他订阅者 */
        }
      }
    },
    reset() {
      listeners.clear();
    },
  };
}

/**
 * Fake db：极简事务替身。`tx` 调用回收集到 calls；`tx.call(name, input)`
 * 查 stub 表，若命中则返回 stub 的 output，否则抛 `not stubbed`。
 */
export interface FakeDbStub {
  /** service.name → input 匹配器（精确等同）→ output。 */
  provides?: Record<string, (input: unknown) => unknown>;
}

export interface FakeDbTx {
  /** 已调用的 service 名序列。 */
  calls: Array<{ name: string; input: unknown; result?: unknown; error?: string | undefined }>;
  call<T = unknown>(name: string, input?: unknown): Promise<T>;
}

export interface FakeDb {
  /** 重置事务记录（每个用例前调一次）。 */
  reset(): void;
  /** 跑一次事务；callback 收到一个 tx 句柄。 */
  tx<T>(cb: (tx: FakeDbTx) => Promise<T> | T): Promise<T>;
  /** 配置 service stub（替代真 service 行为）。 */
  stubServices(opts: FakeDbStub): void;
}

export function createFakeDb(initial?: FakeDbStub): FakeDb {
  const txLog: FakeDbTx["calls"] = [];
  let stubs = initial?.provides ?? {};

  return {
    reset() {
      txLog.length = 0;
    },
    stubServices(opts) {
      stubs = opts.provides ?? {};
    },
    async tx<T>(cb: (tx: FakeDbTx) => Promise<T> | T): Promise<T> {
      const tx: FakeDbTx = {
        calls: txLog,
        async call<T = unknown>(name: string, input?: unknown): Promise<T> {
          const stub = stubs[name];
          let result: unknown;
          let error: string | undefined;
          try {
            if (!stub) throw new Error(`fake-db: no stub for service "${name}"`);
            result = stub(input);
          } catch (e) {
            error = (e as Error).message;
          }
          txLog.push({ name, input, result, error });
          if (error) throw new Error(error);
          return result as T;
        },
      };
      return cb(tx);
    },
  };
}

/** 断言某 fake player 收到含子串的某类 Msg 消息。 */
export function assertMsg(player: FakePlayer, includes: string, prefix = "§"): boolean {
  return player.log.some((line) => line.includes(prefix) && line.includes(includes));
}

/* ──────────────────────────────────────────────────────────────────
 * runLifecycle —— 跳过 ConfigManager/ModuleRegistry 门禁，直接调 hooks
 * ──────────────────────────────────────────────────────────────── */

import type { ModuleDescriptor } from "../module-loader/runtime.js";

export interface RunLifecycleOpts {
  /** 模拟 worldLoad 之后才跑 init（afterWorldLoad=true 的模块需要）。 */
  afterWorldLoad?: boolean;
  /** 测试前可选注入 fake world 给模块 event handler 内部使用（harness 不自动注入）。 */
  world?: FakeWorld;
  /** 测试前可选注入 fake db 给模块 db.tx 内部使用。 */
  db?: FakeDb;
  /** 测试前可选注入 default fake player（模块主动用 Msg.* 时给个替身）。 */
  defaultPlayer?: FakePlayer;
}

/**
 * 把模块 lifecycle 直接跑一遍：registerPermissions → registerCommands → registerEvents → (init?）。
 * cleanup 也是同款接口（独立调 runCleanup）。
 *
 * 注意：这是 **harness 旁路**，不替代 ModuleRegistry.bootModule/cleanupModule（那些需要
 * ConfigManager / 真 db-server）。模块若在 hooks 内调 db/config/service，必须用 opts.db 注入，
 * 或自己 stub 这些调用。
 */
export async function runLifecycle(
  descriptor: ModuleDescriptor,
  opts: RunLifecycleOpts = {}
): Promise<{ ok: boolean; error?: unknown }> {
  try {
    descriptor.lifecycle.registerPermissions?.();
    descriptor.lifecycle.registerCommands?.();
    descriptor.lifecycle.registerEvents?.();
    if (opts.afterWorldLoad !== false && !descriptor.afterWorldLoad) {
      const r = descriptor.lifecycle.init?.();
      if (r && typeof (r as Promise<unknown>).then === "function") {
        await r;
      }
    } else if (opts.afterWorldLoad === true && descriptor.afterWorldLoad) {
      const r = descriptor.lifecycle.init?.();
      if (r && typeof (r as Promise<unknown>).then === "function") {
        await r;
      }
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e };
  }
}

export async function runCleanup(descriptor: ModuleDescriptor): Promise<{ ok: boolean; error?: unknown }> {
  try {
    const r = descriptor.lifecycle.cleanup?.();
    if (r && typeof (r as Promise<unknown>).then === "function") {
      await r;
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e };
  }
}

/**
 * 把模块 entry 文件（sapi/src/index.ts）加载进 Node 测试运行时。
 * 用法：`await importModuleEntry("./sapi/src/index.ts")`，需要测试运行期支持
 * TypeScript（建议 `tsx` 或 `node --import tsx`）。
 */
export async function importModuleEntry(path: string): Promise<unknown> {
  /* node 22+ 支持 --experimental-strip-types；tsx 提供更稳的 esm 加载。
   * 调用方负责用 tsx 或 --import tsx 跑测试。 */
  return import(path);
}

/** 在 node --test 用法里常用的 helper：把 Msg 调用挂到 fake player。 */
export function interceptMsgFor(player: FakePlayer): void {
  /* Msg.* 通过 player.sendMessage 发；只要 player 是 fake，Msg.* 自然走 player.log。
   * 此函数仅作为 API 对齐占位 —— 实际无需做额外 hook。 */
  void player;
}