/**
 * HttpDB → ConfigManager.DataAdapter 适配器(DIP)。
 * ConfigManager 只依赖 DataAdapter 抽象;本文件是 module-loader 侧唯一 HttpDB 装配点。
 */

import { HttpDB } from "../sapi/runtime/httpdb.js";
import type { DataAdapter } from "./internal/config-manager.js";

/** 用 HttpDB 实现 DataAdapter;可选覆盖 db-server 基址。 */
export function createHttpDataAdapter(opts?: { baseUrl?: string }): DataAdapter {
  if (opts?.baseUrl) HttpDB.configure({ baseUrl: opts.baseUrl });
  return {
    checkHealth: async () => {
      await HttpDB.checkHealth();
    },
    getAllConfigs: async () => HttpDB.get("/api/sfmc/configs/all"),
    getModules: async () => HttpDB.get("/api/sfmc/modules"),
    setAuthToken: (token: string) => {
      HttpDB.setAuthToken(token);
    },
  };
}
