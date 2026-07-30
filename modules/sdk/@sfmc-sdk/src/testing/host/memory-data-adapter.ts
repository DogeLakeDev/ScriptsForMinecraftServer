/**
 * 内存 DataAdapter — 测试沙箱用，不连 db-server。
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

export function createMemoryDataAdapter(all: MemoryConfigsAll = {}): DataAdapter {
  const payload: MemoryConfigsAll = {
    modules: all.modules ?? [],
    module_tokens: all.module_tokens ?? {},
    settings: all.settings ?? {},
    permissions: all.permissions ?? [],
  };
  const text = JSON.stringify(payload);
  return {
    async getAllConfigs() {
      return text;
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
