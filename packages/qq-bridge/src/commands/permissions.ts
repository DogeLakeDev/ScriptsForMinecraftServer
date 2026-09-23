import { log } from "../log.js";
import { fetchJoinPending } from "./db-api.js";
import type { CommandContext } from "./types.js";

/** 复用服务端最终鉴权，权限不可达时关闭管理入口。 */
export async function authorizeAdmin(ctx: CommandContext): Promise<boolean> {
  const { dbHost: host, dbPort: port } = ctx.runtimeInfo;
  if (!host || !port || !ctx.inbound.userId) return false;
  try {
    const result = await fetchJoinPending({ host, port }, ctx.inbound.userId, ctx.inbound.isGroupAdmin === true);
    return result.success === true && !result.error;
  } catch (error) {
    log.warn(`管理权限查询失败: ${String(error)}`);
    return false;
  }
}
