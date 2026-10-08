/**
 * 只读列出 QQ 绑定记录。
 * 使用场景：桌面端「允许名单」展示谁已经绑定。绑定写入仍由 /api/sfmc/qq/bind/confirm 完成，这里不建表、不改文件。
 */
import { existsSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";

/** 与 sfmc_qq_bindings 的列对应。 */
export interface QqBindingRecord {
  playerName: string;
  playerXuid: string;
  qqUserOpenid: string;
  qqBackend: string;
  boundAt: number;
}

const text = (value: unknown) => (typeof value === "string" ? value : "");

/**
 * 打开业务库并读取绑定表。文件或表不存在时返回空数组，不创建数据库。
 */
export function readQqBindings(filePath: string): QqBindingRecord[] {
  if (!existsSync(filePath)) return [];
  let db: DatabaseSync | undefined;
  try {
    db = new DatabaseSync(filePath, { readOnly: true });
    db.exec("PRAGMA query_only = ON");
    db.exec("PRAGMA busy_timeout = 5000");
    const rows = db.prepare(
      "SELECT qq_user_openid, player_xuid, player_name, qq_backend, bound_at FROM sfmc_qq_bindings ORDER BY bound_at DESC"
    ).all() as Array<{
      qq_user_openid: unknown;
      player_xuid: unknown;
      player_name: unknown;
      qq_backend: unknown;
      bound_at: unknown;
    }>;
    return rows.flatMap((row) => {
      const playerXuid = text(row.player_xuid).trim();
      const boundAt = typeof row.bound_at === "number" ? row.bound_at : Number(row.bound_at);
      if (!playerXuid || !Number.isSafeInteger(boundAt)) return [];
      return [{
        playerName: text(row.player_name).trim(),
        playerXuid,
        qqUserOpenid: text(row.qq_user_openid).trim(),
        qqBackend: text(row.qq_backend).trim(),
        boundAt,
      }];
    });
  } catch {
    return [];
  } finally {
    try { db?.close(); } catch { /* 只读连接关闭失败时按没有绑定记录处理。 */ }
  }
}
