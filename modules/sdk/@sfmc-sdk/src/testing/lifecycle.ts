/**
 * runLifecycle / runCleanup — 旁路 ConfigManager，直接调 hooks。
 * 默认集成路径请用 createSandbox（宿主分相）；本文件仅供钩子单测。
 */

import type { ModuleDescriptor } from "@sfmc-bds/sdk/module-loader";
import type { FakeWorld } from "./engine/world.js";
import type { FakeDb } from "./fake-db.js";
import type { FakePlayer } from "./engine/player.js";

export interface RunLifecycleOpts {
  afterWorldLoad?: boolean;
  world?: FakeWorld;
  db?: FakeDb;
  defaultPlayer?: FakePlayer;
}

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
