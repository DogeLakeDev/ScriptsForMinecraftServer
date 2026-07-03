/**
 * Storage — 纯内存缓存 + HttpDB 持久化
 *
 * 所有数据优先从内存缓存读取（同步），写入时同步更新缓存 + 异步写 HttpDB。
 * 启动时从 HttpDB 加载全部 KV 到缓存，不再使用 Dynamic Property。
 *
 * 高频写入场景（如 OnlineTime 每秒 tick）请使用 setThrottled / setPlayerThrottled，
 * 这些方法会以 30 秒为间隔批量 flush 到 HttpDB，避免请求风暴。
 */

import { world, Player } from "@minecraft/server";
import { HttpDB } from "./HttpDB";

// ============================================
//  缓存层
// ============================================

const cache = new Map<string, string>();

// 节流写入队列
let dirtyKeys = new Set<string>();
let flushScheduled = false;

const FLUSH_INTERVAL = 30_000; // 30 秒

function scheduleFlush() {
  if (flushScheduled) return;
  flushScheduled = true;
  import("@minecraft/server").then(({ system }) => {
    system.runTimeout(() => {
      flushScheduled = false;
      flushDirty();
    }, FLUSH_INTERVAL / 50);
  }).catch(() => {});
}

async function flushDirty() {
  if (dirtyKeys.size === 0) return;
  const keys = [...dirtyKeys];
  dirtyKeys = new Set();
  for (const key of keys) {
    const val = cache.get(key);
    if (val !== undefined) {
      await HttpDB.setKV(key, val).catch(() => {});
    }
  }
}

// ============================================
//  公开 API
// ============================================

export class Storage {
  private static initialized = false;

  /** 初始化：从 HttpDB 加载全部 KV 到缓存 */
  static async init(): Promise<void> {
    if (this.initialized) return;

    try {
      const all = await HttpDB.getAllKV();
      if (all && all.length > 0) {
        for (const { key, value } of all) {
          cache.set(key, value);
        }
        console.info(`[Storage] 从 HttpDB 加载了 ${all.length} 条数据`);
      } else {
        console.info("[Storage] HttpDB 无数据，使用空缓存");
      }
    } catch {
      console.info("[Storage] HttpDB 不可用，使用空缓存");
    }
    this.initialized = true;
  }

  // ---- 同步读写 ----

  /** 读取缓存 */
  static get<T = any>(key: string, fallback: T): T {
    const raw = cache.get(key);
    if (raw !== undefined) {
      try { return JSON.parse(raw) as T; }
      catch { return raw as unknown as T; }
    }
    return fallback;
  }

  /** 写入缓存 + HttpDB（立即写入） */
  static set(key: string, value: unknown): void {
    const json = JSON.stringify(value);
    cache.set(key, json);
    HttpDB.setKV(key, json).catch(() => {});
  }

  /** 删除缓存 + HttpDB */
  static delete(key: string): void {
    cache.delete(key);
    HttpDB.deleteKV(key).catch(() => {});
  }

  // ---- 节流写入（高频场景用，30 秒批量 flush） ----

  /** 写入缓存 + 延迟写入 HttpDB（30 秒内合并） */
  static setThrottled(key: string, value: unknown): void {
    const json = JSON.stringify(value);
    cache.set(key, json);
    dirtyKeys.add(key);
    scheduleFlush();
  }

  // ---- Player 快捷方法 ----

  static playerGet<T = any>(player: Player, key: string, fallback: T): T {
    return this.get(`player:${player.id}:${key}`, fallback);
  }

  static playerSet(player: Player, key: string, value: unknown): void {
    this.set(`player:${player.id}:${key}`, value);
  }

  static playerDelete(player: Player, key: string): void {
    this.delete(`player:${player.id}:${key}`);
  }

  static playerSetThrottled(player: Player, key: string, value: unknown): void {
    this.setThrottled(`player:${player.id}:${key}`, value);
  }
}
