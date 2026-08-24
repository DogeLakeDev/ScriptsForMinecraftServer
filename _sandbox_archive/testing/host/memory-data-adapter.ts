/**
 * 内存 DataAdapter — 测试沙箱用，不连 db-server。
 * 可变：夹具面板可 patch 后经 ConfigManager.loadAll / refreshModules 刷新。
 */

import type { DataAdapter } from "@sfmc-bds/sdk/module-loader";

export type MemoryConfigsAll = {
  modules?: Array<{
    id?: string;
    module_id?: string;
    config_key?: string;
    configKey?: string;
    name?: string;
    enabled?: boolean;
    installed?: boolean;
  }>;
  module_tokens?: Record<string, string>;
  settings?: Record<string, unknown>;
  permissions?: Array<{ player_name: string; level: number }>;
};

function clonePayload(all: MemoryConfigsAll): MemoryConfigsAll {
  return {
    modules: structuredClone(all.modules ?? []),
    module_tokens: structuredClone(all.module_tokens ?? {}),
    settings: structuredClone(all.settings ?? {}),
    permissions: structuredClone(all.permissions ?? []),
  };
}

export type MemoryDataAdapter = DataAdapter & {
  /** 当前内存 configs/all 快照副本。 */
  getSnapshot(): MemoryConfigsAll;
  /** 整表替换。 */
  replace(all: MemoryConfigsAll): void;
  /** 浅合并顶层域（modules / settings / permissions / module_tokens）。 */
  patch(partial: Partial<MemoryConfigsAll>): void;
};

export function createMemoryDataAdapter(all: MemoryConfigsAll = {}): MemoryDataAdapter {
  let payload = clonePayload(all);
  return {
    getSnapshot() {
      return clonePayload(payload);
    },
    replace(next) {
      payload = clonePayload(next);
    },
    patch(partial) {
      if (partial.modules !== undefined) payload.modules = structuredClone(partial.modules);
      if (partial.module_tokens !== undefined) {
        payload.module_tokens = structuredClone(partial.module_tokens);
      }
      if (partial.settings !== undefined) {
        payload.settings = { ...(payload.settings ?? {}), ...structuredClone(partial.settings) };
      }
      if (partial.permissions !== undefined) {
        payload.permissions = structuredClone(partial.permissions);
      }
    },
    async getAllConfigs() {
      return JSON.stringify(payload);
    },
    async getModules() {
      return JSON.stringify({ modules: payload.modules });
    },
    setAuthToken(_token: string) {
      /* noop */
    },
    async checkHealth() {
      /* noop */
    },
  };
}
