/**
 * commands/interaction-router.ts — 官方 INTERACTION_CREATE 分发
 *
 * data 约定：
 *   join:approve:<id> / join:reject:<id>
 *   cfg:allowlist|approval:on|off
 */

import {
  ackInteraction,
  sendC2cMessage,
  sendGroupMessage,
  type QqOfficialCredentials,
} from "@sfmc-bds/sdk/node/qq-official";
import { log } from "../log.js";
import { postJoinDecide, postJoinSettings, type DbEndpoint } from "./db-api.js";
import {
  buildJoinSettingsPanel,
  parseCfgInteractionData,
  settingsFromResponse,
} from "./join-settings-ui.js";
import { renderOfficial } from "./render.js";

export type InteractionPayload = {
  id?: string;
  data?: string;
  group_openid?: string;
  chat_type?: number;
  /** 点击人 */
  user_openid?: string;
  member_openid?: string;
  author?: { id?: string; member_openid?: string; user_openid?: string };
};

export type InteractionRouterOpts = {
  creds: QqOfficialCredentials;
  db: DbEndpoint;
  adminOpenids: string[];
};

const recentIds = new Map<string, number>();
const DEDUP_MS = 60_000;

function remember(id: string): boolean {
  const now = Date.now();
  for (const [k, t] of recentIds) {
    if (now - t > DEDUP_MS) recentIds.delete(k);
  }
  if (recentIds.has(id)) return false;
  recentIds.set(id, now);
  return true;
}

function extractUserOpenid(d: InteractionPayload): string {
  return String(
    d.user_openid ||
      d.member_openid ||
      d.author?.member_openid ||
      d.author?.user_openid ||
      d.author?.id ||
      ""
  ).trim();
}

function extractData(d: InteractionPayload): string {
  const raw = d.data;
  if (typeof raw === "string") return raw.trim();
  // 部分事件把 button 嵌在 nested 字段
  const nested = d as Record<string, unknown>;
  for (const key of ["button_data", "button", "event_data"]) {
    const v = nested[key];
    if (typeof v === "string") return v.trim();
    if (v && typeof v === "object" && "data" in (v as object)) {
      return String((v as { data?: string }).data ?? "").trim();
    }
  }
  return "";
}

async function replyGroup(
  opts: InteractionRouterOpts,
  groupOpenid: string,
  text: string,
  panel?: ReturnType<typeof buildJoinSettingsPanel>
): Promise<void> {
  if (!groupOpenid) return;
  if (panel) {
    const rendered = renderOfficial(panel);
    const res = await sendGroupMessage(opts.creds, {
      groupOpenid,
      msgType: rendered.msgType,
      ...(rendered.msgType === 2
        ? { markdown: rendered.markdown ?? panel.text }
        : { content: rendered.content ?? panel.text }),
      ...(rendered.keyboardButtons ? { keyboardButtons: rendered.keyboardButtons } : {}),
    });
    if (res.ok) return;
    log.warn(`配置面板 Markdown 发送失败，降级文本: ${res.error}`);
  }
  await sendGroupMessage(opts.creds, { groupOpenid, content: text });
}

export function createInteractionRouter(opts: InteractionRouterOpts) {
  return {
    async handle(raw: unknown): Promise<void> {
      const d = (raw ?? {}) as InteractionPayload;
      const interactionId = String(d.id ?? "").trim();
      if (!interactionId) {
        log.warn("INTERACTION 缺少 id，跳过");
        return;
      }
      if (!remember(interactionId)) {
        log.info(`INTERACTION 去重跳过 id=${interactionId}`);
        return;
      }

      // 先 ack，避免客户端一直 loading
      const ack = await ackInteraction(opts.creds, interactionId);
      if (!ack.ok) {
        log.warn(`ackInteraction 失败: ${ack.error}`);
      }

      const userId = extractUserOpenid(d);
      const data = extractData(d);
      const groupOpenid = String(d.group_openid ?? "").trim();
      log.info(`INTERACTION data=${data || "?"} user=${userId || "?"} group=${groupOpenid || "?"}`);

      const cfg = parseCfgInteractionData(data);
      if (cfg) {
        if (!opts.adminOpenids.includes(userId)) {
          await replyGroup(opts, groupOpenid, "你没有配置权限。");
          return;
        }
        try {
          const body: {
            openid: string;
            allowlist_enabled?: boolean;
            require_approval?: boolean;
          } = { openid: userId };
          if (cfg.field === "allowlist_enabled") body.allowlist_enabled = cfg.value;
          else body.require_approval = cfg.value;

          const { data: result } = await postJoinSettings(opts.db, body);
          if (result.success === false) {
            await replyGroup(opts, groupOpenid, `保存失败：${result.error || result.note || "unknown"}`);
            return;
          }
          const panel = buildJoinSettingsPanel({
            settings: settingsFromResponse(result),
            backend: "official",
            adminOpenids: opts.adminOpenids,
            prefix: "已保存",
          });
          await replyGroup(opts, groupOpenid, panel.text, panel);
        } catch (e) {
          log.warn(`cfg settings 失败: ${(e as Error).message}`);
          await replyGroup(opts, groupOpenid, `保存失败：${(e as Error).message}`);
        }
        return;
      }

      const m = /^(join):(approve|reject):(.+)$/.exec(data);
      if (!m) {
        log.warn(`未知 INTERACTION data: ${data.slice(0, 80)}`);
        return;
      }
      const decision = m[2] === "approve" ? ("approve" as const) : ("reject" as const);
      const requestId = String(m[3] ?? "").trim();
      if (!requestId) return;

      if (!opts.adminOpenids.includes(userId)) {
        if (groupOpenid) {
          await sendGroupMessage(opts.creds, {
            groupOpenid,
            content: "你没有审批权限。",
          });
        }
        return;
      }

      try {
        const { data: result } = await postJoinDecide(opts.db, {
          id: requestId,
          decision,
          decided_by: userId,
        });
        const name = result.player_name || "?";
        const text =
          result.success === false
            ? `审批失败：${result.error || "unknown"}`
            : decision === "approve"
              ? `已通过「${name}」入服申请（等待 BDS 写入白名单）`
              : `已拒绝「${name}」入服申请`;
        if (groupOpenid) {
          await sendGroupMessage(opts.creds, { groupOpenid, content: text });
        }
        // 通知申请人（单聊；失败忽略）
        const applicant = String(result.applicant_openid ?? "").trim();
        if (result.success !== false && applicant) {
          const tip =
            decision === "approve"
              ? `你的入服申请「${name}」已通过，请等待服务器写入白名单。`
              : `你的入服申请「${name}」已拒绝。`;
          await sendC2cMessage(opts.creds, { userOpenid: applicant, content: tip }).catch(() => undefined);
        }
      } catch (e) {
        log.warn(`join decide 失败: ${(e as Error).message}`);
      }
    },
  };
}

export type InteractionRouter = ReturnType<typeof createInteractionRouter>;
