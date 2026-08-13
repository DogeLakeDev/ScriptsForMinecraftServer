/**
 * qq-events-notify.ts — 向 db-server 上报 BDS 启停事件
 *
 * 只 POST 结构化事件；群 openid / 频控由 db-server 处理（DIP）。
 * 失败仅 warn，不抛错。
 */

import {
  DEFAULT_DB_CONFIG,
  loadEnsuredConfig,
  type DBConfig,
} from "@sfmc-bds/sdk/node/config";
import http from "node:http";
import { log } from "./log.js";
import { ROOT_DIR } from "./paths.js";

export type BdsLifecycleEventType = "crash" | "start";

function resolveDbPort(): number {
  try {
    const cfg = loadEnsuredConfig(
      ROOT_DIR,
      "db_config.json",
      "db_config",
      { ...DEFAULT_DB_CONFIG } as Record<string, unknown>
    ) as DBConfig;
    const n = Number(cfg.db_port ?? 3001);
    return Number.isFinite(n) && n > 0 ? n : 3001;
  } catch {
    return 3001;
  }
}

/**
 * POST /api/sfmc/qq/events；超时/非 2xx 不抛。
 */
export function postBdsLifecycleEvent(
  type: BdsLifecycleEventType,
  detail?: string,
  opts?: { host?: string; port?: number; timeoutMs?: number }
): Promise<void> {
  const host = opts?.host ?? "127.0.0.1";
  const port = opts?.port ?? resolveDbPort();
  const timeoutMs = opts?.timeoutMs ?? 3_000;
  const payload = JSON.stringify({
    type,
    detail: detail ?? undefined,
  });

  return new Promise((resolve) => {
    const req = http.request(
      {
        hostname: host,
        port,
        path: "/api/sfmc/qq/events",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(payload),
        },
        timeout: timeoutMs,
      },
      (res) => {
        res.resume();
        res.on("end", () => {
          const code = res.statusCode ?? 0;
          if (code < 200 || code >= 300) {
            log.warn(`[QQ事件] db-server 返回 HTTP ${code} (type=${type})`);
          }
          resolve();
        });
      }
    );
    req.on("timeout", () => {
      req.destroy();
      log.warn(`[QQ事件] 上报超时 ${timeoutMs}ms (type=${type})`);
      resolve();
    });
    req.on("error", (err) => {
      log.warn(`[QQ事件] 上报失败: ${err.message} (type=${type})`);
      resolve();
    });
    req.write(payload);
    req.end();
  });
}
