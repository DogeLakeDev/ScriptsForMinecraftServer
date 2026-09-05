/**
 * HttpDB → ConfigManager.DataAdapter 适配器(DIP)。
 * install 内部装配点
 */

import { HttpDB } from "../sapi/runtime/httpdb.js";
import type { DataAdapter } from "./data-adapter.js";

/** 用 HttpDB 实现 DataAdapter;可选覆盖 db-server 基址。 */
export function createHttpDataAdapter(opts?: { baseUrl?: string }): DataAdapter {
  if (opts?.baseUrl) HttpDB.configure({ baseUrl: opts.baseUrl });
  return {
    checkHealth: async () => {
      await HttpDB.checkHealth();
    },
    getAllConfigs: async () => HttpDB.get("/api/sfmc/configs/all"),
    setAuthToken: (token: string) => {
      HttpDB.setAuthToken(token);
    },
  };
}
