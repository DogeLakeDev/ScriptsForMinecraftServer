import { ackInteraction, type QqOfficialCredentials } from "@sfmc-bds/sdk/node/qq-official";
import { log } from "../log.js";
import { parseCfgInteractionData } from "./join-settings-ui.js";
import type { CommandRouter } from "./router.js";

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
        d["user_openid"] || d["member_openid"] || author["member_openid"] || author["user_openid"] || author["id"] || ""
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
      // 旧回调没有可靠群角色信息，服务端仅按明确管理员身份授权。
      await opts.commandRouter.handle({
        backend: "official",
        groupId: group,
        userId: user,
        userName: "群成员",
        text: command,
      });
    },
  };
}
export type InteractionRouter = ReturnType<typeof createInteractionRouter>;
