import { ackInteraction, getGroupMember, type QqOfficialCredentials } from "@sfmc-bds/sdk/node/qq-official";
import { log } from "../log.js";
import { cachedGroupAdmin, isPrivilegedGroupRole, rememberGroupRole } from "../official/group-role.js";
import { parseCfgInteractionData } from "./join-settings-ui.js";
import type { CommandRouter } from "./router.js";

/** 成员接口无权限时只提示一次，避免每次点按钮都刷日志。 */
let memberLookupWarned = false;

/**
 * 按钮回调没有 member_role，先用最近群消息缓存，再查成员接口。
 * 使用场景：群管点管理菜单时补齐 isGroupAdmin，供 db-server 按群管授权。
 */
async function resolveInteractionGroupAdmin(
  creds: QqOfficialCredentials,
  groupOpenid: string,
  memberOpenid: string,
  raw: Record<string, unknown>
): Promise<boolean> {
  const author = (raw["author"] ?? {}) as Record<string, unknown>;
  const direct = raw["member_role"] ?? author["member_role"];
  if (direct != null) {
    const admin = isPrivilegedGroupRole(direct);
    rememberGroupRole(memberOpenid, admin);
    return admin;
  }
  const cached = cachedGroupAdmin(memberOpenid);
  if (cached !== undefined) return cached;
  const res = await getGroupMember(creds, groupOpenid, memberOpenid);
  if (!res.ok) {
    if (!memberLookupWarned) {
      memberLookupWarned = true;
      log.warn(`查询群成员角色失败，按钮回调暂无法按群管授权: ${res.error}`);
    }
    return false;
  }
  const role =
    res.json && typeof res.json === "object" ? (res.json as { member_role?: unknown }).member_role : undefined;
  if (role == null) return false;
  const admin = isPrivilegedGroupRole(role);
  rememberGroupRole(memberOpenid, admin);
  return admin;
}

export type InteractionRouterOpts = { creds: QqOfficialCredentials; commandRouter: CommandRouter; groupOpenid: string };
export function createInteractionRouter(opts: InteractionRouterOpts) {
  const recent = new Map<string, number>();
  return {
    async handle(raw: unknown): Promise<void> {
      const d = (raw ?? {}) as Record<string, unknown>;
      const id = String(d["id"] ?? "");
      if (!id) return;
      for (const [key, time] of recent) if (Date.now() - time > 60_000) recent.delete(key);
      if (recent.has(id)) return;
      recent.set(id, Date.now());
      try {
        const ack = await ackInteraction(opts.creds, id);
        if (!ack.ok) log.warn(`按钮应答失败: ${ack.error}`);
      } catch (error) {
        log.warn(`按钮应答失败: ${String(error)}`);
      }
      const author = (d["author"] ?? {}) as Record<string, unknown>;
      const user = String(
        d["group_member_openid"] ||
          d["user_openid"] ||
          d["member_openid"] ||
          author["member_openid"] ||
          author["user_openid"] ||
          author["id"] ||
          ""
      );
      const group = String(d["group_openid"] ?? "");
      if (!user || !group || group !== opts.groupOpenid) return;
      let data = "";
      for (const key of ["data", "button_data", "button", "event_data"]) {
        const value = d[key];
        if (typeof value === "string") {
          data = value.trim();
          break;
        }
        if (value && typeof value === "object" && "data" in value) {
          data = String(value.data);
          break;
        }
      }
      const cfg = parseCfgInteractionData(data);
      const join = /^join:(approve|reject):(.+)$/.exec(data);
      const command = cfg
        ? `/config ${cfg.field === "allowlist_enabled" ? "白名单" : "审批"} ${cfg.value ? "开" : "关"}`
        : join
          ? `/${join[1]} ${join[2]}`
          : "/help";
      const isGroupAdmin = await resolveInteractionGroupAdmin(opts.creds, group, user, d);
      await opts.commandRouter.handle({
        backend: "official",
        groupId: group,
        userId: user,
        userName: "群成员",
        text: command,
        isGroupAdmin,
      });
    },
  };
}
export type InteractionRouter = ReturnType<typeof createInteractionRouter>;
