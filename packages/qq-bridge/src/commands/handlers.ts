/**
 * commands/handlers.ts — 内置 menu / ping / whoami / status / online / bind / join / kick / group
 */

import {
  getGroupBotState,
  getGroupInfo,
  sendGroupMessage,
} from "@sfmc-bds/sdk/node/qq-official";
import {
  fetchBindMe,
  fetchJoinPending,
  fetchJoinSettings,
  fetchSfmcStatus,
  postAdminKick,
  postBindRequest,
  postBindUnbind,
  postJoinDecide,
  postJoinRequest,
  postJoinSettings,
  type DbEndpoint,
} from "./db-api.js";
import { buildJoinSettingsPanel, settingsFromResponse } from "./join-settings-ui.js";
import { formatCommandMenu } from "./menu-format.js";
import type { CommandRegistry } from "./registry.js";
import type { CommandContext, CommandHandler, CommandResult } from "./types.js";

function formatUptime(startedAt: number): string {
  const ms = Math.max(0, Date.now() - startedAt);
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}h ${m % 60}m`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}

function dbEp(ctx: CommandContext): DbEndpoint | null {
  const host = ctx.runtimeInfo.dbHost;
  const port = ctx.runtimeInfo.dbPort;
  if (!host || !port) return null;
  return { host, port };
}

function isAdmin(ctx: CommandContext): boolean {
  const admins = ctx.runtimeInfo.adminOpenids ?? [];
  if (admins.length > 0 && admins.includes(ctx.inbound.userId)) return true;
  // 群管：桥侧先放行；db 再按 treat_group_admins_as_admins 鉴权
  return ctx.inbound.isGroupAdmin === true;
}

function asGroupAdminField(ctx: CommandContext): boolean {
  return ctx.inbound.isGroupAdmin === true;
}

/** 拉取官方群 info + bot_state；失败返回提示行 */
async function fetchQqGroupLines(ctx: CommandContext): Promise<string[]> {
  const creds = ctx.runtimeInfo.officialCreds;
  const gid = ctx.runtimeInfo.groupOpenid || ctx.inbound.groupId;
  if (!creds || !gid || ctx.inbound.backend !== "official") return [];
  const lines: string[] = [];
  try {
    const [infoRes, stateRes] = await Promise.all([
      getGroupInfo(creds, gid),
      getGroupBotState(creds, gid),
    ]);
    if (infoRes.ok && infoRes.json && typeof infoRes.json === "object") {
      const j = infoRes.json as Record<string, unknown>;
      lines.push(`QQ群：${j.group_name ?? "—"} · 成员 ${j.group_member_num ?? "—"}`);
    } else if (!infoRes.ok) {
      const hint = /11253/.test(infoRes.error || infoRes.body || "")
        ? "群信息接口未开通白名单(11253)"
        : `群信息失败：${(infoRes.error || "").slice(0, 60)}`;
      lines.push(hint);
    }
    if (stateRes.ok && stateRes.json && typeof stateRes.json === "object") {
      const j = stateRes.json as Record<string, unknown>;
      lines.push(
        `机器人：角色=${j.member_role ?? "—"} · 主动推送=${j.allow_proactive_msg === true ? "开" : "关"} · 收消息=${j.recv_msg_setting ?? "—"}`
      );
    }
  } catch (e) {
    lines.push(`群信息异常：${(e as Error).message}`);
  }
  return lines;
}

export function createMenuHandler(registry: CommandRegistry): CommandHandler {
  return (): CommandResult => {
    const cmds = registry.userMenu().filter((c) => c.name !== "menu");
    return formatCommandMenu({
      title: "SFMC 指令",
      subtitle: "点按钮或发名称/编号；管理员发「管理」打开管理菜单。",
      cmds,
      idPrefix: "cmd",
      footerMd: "_官方仅 @机器人 触发；游戏聊天需配置 `bridge_channel_id`。_",
      footerText: "官方仅 @机器人 触发；游戏聊天需配置 bridge_channel_id。",
    });
  };
}

/** 管理子菜单：仅管理员；列出 adminMenu 指令 */
export function createAdminMenuHandler(registry: CommandRegistry): CommandHandler {
  return (ctx: CommandContext): CommandResult => {
    if (!isAdmin(ctx)) {
      return { text: "仅管理员可打开管理菜单（需在 qq_admin_openids，或开启群管视作管理员）" };
    }
    const cmds = registry.adminMenu();
    if (cmds.length === 0) {
      return { text: "暂无管理指令" };
    }
    return formatCommandMenu({
      title: "SFMC 管理",
      subtitle: "以下为管理指令；也可直接发「踢人」「待审」等触发词。",
      cmds,
      idPrefix: "adm",
      footerMd: "_敏感操作请确认对象正确。_",
      footerText: "敏感操作请确认对象正确。",
    });
  };
}

export const pingHandler: CommandHandler = (ctx: CommandContext): CommandResult => {
  const { runtimeInfo, startedAt, inbound } = ctx;
  const parts = ["pong", `backend=${inbound.backend}`, `uptime=${formatUptime(startedAt)}`];
  if (inbound.backend === "official") {
    parts.push(`sandbox=${runtimeInfo.sandbox ? "true" : "false"}`);
    if (runtimeInfo.appIdHint) parts.push(`app=${runtimeInfo.appIdHint}`);
  }
  return { text: parts.join(" · ") };
};

export const whoamiHandler: CommandHandler = async (ctx: CommandContext): Promise<CommandResult> => {
  const { inbound } = ctx;
  const lines = [`你是 ${inbound.userName}`, `id=${inbound.userId}`, `group=${inbound.groupId}`];
  const ep = dbEp(ctx);
  if (ep) {
    try {
      const me = await fetchBindMe(ep, inbound.userId);
      if (me.bound && me.binding) {
        lines.push(`已绑定 MC：${me.binding.player_name || "?"} (${me.binding.player_xuid || "?"})`);
      } else {
        lines.push("未绑定 MC（发送「绑定」获取验证码）");
      }
    } catch {
      lines.push("绑定查询失败（db-server 不可达）");
    }
  }
  return { text: lines.join("\n") };
};

export const statusHandler: CommandHandler = async (ctx: CommandContext): Promise<CommandResult> => {
  const ep = dbEp(ctx);
  if (!ep) return { text: "status：未配置 db_host/db_port" };
  try {
    const st = await fetchSfmcStatus(ep);
    const n = Array.isArray(st.online) ? st.online.length : 0;
    const day = st.world?.day != null ? String(st.world.day) : "—";
    const diff = st.world?.difficulty ? String(st.world.difficulty) : "—";
    const age =
      typeof st.updatedAt === "number" ? `${Math.max(0, Math.floor((Date.now() - st.updatedAt) / 1000))}s前` : "—";
    const host = st.host;
    const bds = st.processes?.bds;
    const db = st.processes?.db;
    const hostUp = host?.uptimeText || "—";
    const bdsLine =
      bds?.state === "running"
        ? `运行中 · ${bds.uptimeText || "—"}${bds.pid ? ` (PID ${bds.pid})` : ""}`
        : "未运行";
    const mem =
      host?.memory != null
        ? `${host.memory.usedMb ?? "—"}/${host.memory.totalMb ?? "—"} MB (${host.memory.usedPercent ?? "—"}%)`
        : "—";
    const cpu =
      host?.cpu != null ? `${host.cpu.cores ?? "—"} 核 · ${host.cpu.model || "—"}` : "—";
    const machine = host
      ? `${host.hostname || "—"} · ${host.platform || "—"}/${host.arch || "—"} ${host.release || ""}`.trim()
      : "—";
    const note = st.note ? `\n${st.note}` : n === 0 ? "\n暂无在线玩家数据" : "";
    const qqLines = await fetchQqGroupLines(ctx);
    const text = [
      "服务器状态",
      `在线：${n} 人`,
      `世界日：${day}`,
      `难度：${diff}`,
      `主机：${machine}`,
      `主机运行：${hostUp}`,
      `BDS：${bdsLine}`,
      `内存：${mem}`,
      `CPU：${cpu}`,
      `db-server：${db?.uptimeText || "—"}${db?.pid ? ` (PID ${db.pid})` : ""}`,
      ...qqLines,
      `数据：${age}${note}`,
    ].join("\n");
    const markdown = [
      "## 服务器状态",
      "",
      `- **在线**：${n} 人`,
      `- **世界日**：${day}`,
      `- **难度**：${diff}`,
      `- **主机**：${machine}`,
      `- **主机运行**：${hostUp}`,
      `- **BDS**：${bdsLine}`,
      `- **内存**：${mem}`,
      `- **CPU**：${cpu}`,
      `- **db-server**：${db?.uptimeText || "—"}${db?.pid ? ` (PID ${db.pid})` : ""}`,
      ...qqLines.map((l) => `- ${l}`),
      `- **数据**：${age}`,
      note ? `\n_${(st.note || "暂无在线玩家数据").trim()}_` : "",
    ]
      .filter((line) => line !== "")
      .join("\n");
    return { text, markdown };
  } catch (e) {
    return { text: `status 失败：${(e as Error).message}` };
  }
};

const ONLINE_CAP = 30;

export const onlineHandler: CommandHandler = async (ctx: CommandContext): Promise<CommandResult> => {
  const ep = dbEp(ctx);
  if (!ep) return { text: "online：未配置 db_host/db_port" };
  try {
    const st = await fetchSfmcStatus(ep);
    const list = Array.isArray(st.online) ? st.online : [];
    if (list.length === 0) {
      return { text: st.note || "暂无在线玩家" };
    }
    const shown = list.slice(0, ONLINE_CAP);
    const names = shown.map((p, i) => `${i + 1}. ${p.name || p.id || "?"}`).join("\n");
    const more = list.length > ONLINE_CAP ? `\n…另有 ${list.length - ONLINE_CAP} 人未列出` : "";
    return { text: `在线 ${list.length} 人\n${names}${more}` };
  } catch (e) {
    return { text: `online 失败：${(e as Error).message}` };
  }
};

export const bindHandler: CommandHandler = async (ctx: CommandContext): Promise<CommandResult> => {
  const ep = dbEp(ctx);
  if (!ep) return { text: "绑定：未配置 db_host/db_port" };
  try {
    const { status, data } = await postBindRequest(ep, {
      openid: ctx.inbound.userId,
      qq_backend: ctx.inbound.backend,
    });
    if (status === 409 || data.error === "already_bound") {
      return {
        text: `你已绑定 MC 玩家「${data.player_name || "?"}」。如需换绑请先发送「解绑」。`,
      };
    }
    if (!data.success || !data.code) {
      return { text: `申请绑定失败：${data.error || `HTTP ${status}`}` };
    }
    return {
      text: `绑定码：${data.code}\n请在游戏内输入 !bind，然后在 60 秒内发送此数字码（不要带 !）。`,
      markdown: `## 绑定码 \`${data.code}\`\n\n1. 游戏内执行 **!bind**\n2. 在 **60 秒内**发送本数字码（不要带 \`!\`）\n\n_超时请重新申请_`,
    };
  } catch (e) {
    return { text: `绑定失败：${(e as Error).message}` };
  }
};

export const unbindHandler: CommandHandler = async (ctx: CommandContext): Promise<CommandResult> => {
  const ep = dbEp(ctx);
  if (!ep) return { text: "解绑：未配置 db_host/db_port" };
  try {
    const { data } = await postBindUnbind(ep, { openid: ctx.inbound.userId });
    if (data.unbound) return { text: "已解除 QQ↔MC 绑定。" };
    return { text: "当前没有绑定记录。" };
  } catch (e) {
    return { text: `解绑失败：${(e as Error).message}` };
  }
};

export const groupInfoHandler: CommandHandler = async (ctx: CommandContext): Promise<CommandResult> => {
  const lines = await fetchQqGroupLines(ctx);
  if (lines.length === 0) {
    return { text: "群信息仅官方后端可用，且需配置 qq_group_openid / 凭证。" };
  }
  return { text: ["QQ 群信息", ...lines].join("\n") };
};

export const joinHandler: CommandHandler = async (ctx: CommandContext): Promise<CommandResult> => {
  const ep = dbEp(ctx);
  if (!ep) return { text: "申请入服：未配置 db_host/db_port" };
  let playerName = ctx.inbound.text.replace(/^\/?(申请入服|join)\s*/i, "").trim();
  if (!playerName) {
    try {
      const me = await fetchBindMe(ep, ctx.inbound.userId);
      if (me.bound && me.binding?.player_name) playerName = String(me.binding.player_name);
    } catch {
      /* ignore */
    }
  }
  if (!playerName) {
    return { text: "用法：申请入服 <玩家名>\n（已绑定可省略名字）" };
  }
  try {
    const { data } = await postJoinRequest(ep, {
      openid: ctx.inbound.userId,
      player_name: playerName,
      qq_backend: ctx.inbound.backend,
    });
    if (!data.success || !data.id) {
      if (data.error === "join_allowlist_disabled") {
        return { text: "入服白名单已关闭（管理员可发「配置 白名单 开」）" };
      }
      return { text: `申请失败：${data.error || "unknown"}` };
    }
    if (data.auto_approved || data.status === "approved") {
      return {
        text: data.note
          ? `「${playerName}」${data.note}`
          : `已自动通过「${playerName}」入服，等待 BDS 写入白名单`,
      };
    }
    const admins = ctx.runtimeInfo.adminOpenids ?? [];
    const creds = ctx.runtimeInfo.officialCreds;
    const gid = ctx.runtimeInfo.groupOpenid || ctx.inbound.groupId;
    if (creds && gid && admins.length > 0 && ctx.inbound.backend === "official") {
      void sendGroupMessage(creds, {
        groupOpenid: gid,
        msgType: 2,
        markdown: `## 入服申请\n\n玩家 **${playerName}**\n申请人 \`${ctx.inbound.userId.slice(0, 8)}…\`\n请求 id=\`${data.id}\``,
        keyboardButtons: [
          {
            id: `ap_${data.id}`,
            label: "通过",
            data: `join:approve:${data.id}`,
            actionType: 1,
            style: 1,
            permission: { type: 0, specify_user_ids: admins },
          },
          {
            id: `rj_${data.id}`,
            label: "拒绝",
            data: `join:reject:${data.id}`,
            actionType: 1,
            style: 0,
            permission: { type: 0, specify_user_ids: admins },
          },
        ],
      }).catch(() => undefined);
    }
    const note = data.note ? `\n${data.note}` : admins.length === 0 ? "\n未配置 qq_admin_openids，管理员收不到通知" : "";
    return {
      text: `已提交入服申请「${playerName}」${note}`,
      buttons:
        ctx.inbound.backend === "llbot" && admins.length > 0
          ? [
              { id: "a", label: `通过 ${playerName}`, command: `/approve ${data.id}` },
              { id: "r", label: `拒绝 ${playerName}`, command: `/reject ${data.id}` },
            ]
          : undefined,
    };
  } catch (e) {
    return { text: `申请失败：${(e as Error).message}` };
  }
};

function parseOnOff(raw: string): boolean | null {
  const s = raw.trim().toLowerCase();
  if (["开", "开启", "on", "true", "1", "yes"].includes(s)) return true;
  if (["关", "关闭", "off", "false", "0", "no"].includes(s)) return false;
  return null;
}

/** 管理员查看/切换 qq-link 入服开关（互动按钮面板） */
export const joinConfigHandler: CommandHandler = async (ctx: CommandContext): Promise<CommandResult> => {
  if (!isAdmin(ctx)) return { text: "仅管理员可配置入服开关（qq_admin_openids / 群管视作管理员）" };
  const ep = dbEp(ctx);
  if (!ep) return { text: "配置：未连接 db" };

  const admins = ctx.runtimeInfo.adminOpenids ?? [];
  const rest = ctx.inbound.text.replace(/^\/?(配置|config|入服配置)\s*/i, "").trim();
  if (!rest) {
    try {
      const data = await fetchJoinSettings(ep);
      if (data.success === false) return { text: `读取失败：${data.error || "unknown"}` };
      return buildJoinSettingsPanel({
        settings: settingsFromResponse(data),
        backend: ctx.inbound.backend,
        adminOpenids: admins,
      });
    } catch (e) {
      return { text: `读取失败：${(e as Error).message}` };
    }
  }

  if (/^(群管|群管理员|treat|group.?admin)/i.test(rest)) {
    return {
      text: "「群管视作管理员」只能改 configs/qq_link.json 的 treat_group_admins_as_admins，群聊不可改。发「配置」可查看当前值。",
    };
  }

  const m = /^(白名单|allowlist|审批|approval)\s+(\S+)/i.exec(rest);
  if (!m) {
    return { text: "用法：配置\n　　　或点面板按钮切换白名单/审批" };
  }
  const which = m[1]!.toLowerCase();
  const onOff = parseOnOff(m[2]!);
  if (onOff === null) return { text: "请使用 开/关（或 on/off）" };

  const body: {
    openid: string;
    as_group_admin?: boolean;
    allowlist_enabled?: boolean;
    require_approval?: boolean;
  } = {
    openid: ctx.inbound.userId,
    as_group_admin: asGroupAdminField(ctx),
  };
  if (which === "白名单" || which === "allowlist") body.allowlist_enabled = onOff;
  else body.require_approval = onOff;

  try {
    const { data } = await postJoinSettings(ep, body);
    if (data.success === false) {
      if (data.error === "not_admin") {
        return { text: "无权限（群管需 configs/qq_link.json 中 treat_group_admins_as_admins=true）" };
      }
      if (data.error === "immutable_field") {
        return { text: data.note || "该字段不可经群聊修改" };
      }
      return { text: `保存失败：${data.error || "unknown"}` };
    }
    return buildJoinSettingsPanel({
      settings: settingsFromResponse(data),
      backend: ctx.inbound.backend,
      adminOpenids: admins,
      prefix: "已保存",
    });
  } catch (e) {
    return { text: `保存失败：${(e as Error).message}` };
  }
};

export const pendingHandler: CommandHandler = async (ctx: CommandContext): Promise<CommandResult> => {
  if (!isAdmin(ctx)) return { text: "仅管理员可查看待审列表（配置 qq_admin_openids）" };
  const ep = dbEp(ctx);
  if (!ep) return { text: "待审：未配置 db" };
  try {
    const data = await fetchJoinPending(ep, ctx.inbound.userId, asGroupAdminField(ctx));
    if (data.error) {
      if (data.error === "not_admin") {
        return { text: "无权限（群管需 treat_group_admins_as_admins=true）" };
      }
      return { text: `待审失败：${data.error}` };
    }
    const list = data.pending ?? [];
    if (list.length === 0) return { text: "暂无待审入服申请" };
    const lines = list.map((r, i) => `${i + 1}. ${r.player_name || "?"} (${r.id})`);
    return { text: `待审 ${list.length} 条\n${lines.join("\n")}` };
  } catch (e) {
    return { text: `待审失败：${(e as Error).message}` };
  }
};

export const approveHandler: CommandHandler = async (ctx: CommandContext): Promise<CommandResult> => {
  if (!isAdmin(ctx)) return { text: "仅管理员可审批" };
  const ep = dbEp(ctx);
  if (!ep) return { text: "未配置 db" };
  const id = ctx.inbound.text.replace(/^\/?(approve|通过)\s*/i, "").trim();
  if (!id) return { text: "用法：通过 <申请id>" };
  try {
    const { data } = await postJoinDecide(ep, {
      id,
      decision: "approve",
      decided_by: ctx.inbound.userId,
      as_group_admin: asGroupAdminField(ctx),
    });
    if (data.success === false && data.error === "not_admin") {
      return { text: "无权限（群管需 treat_group_admins_as_admins=true）" };
    }
    return { text: data.success === false ? `失败：${data.error}` : `已通过「${data.player_name || id}」` };
  } catch (e) {
    return { text: `失败：${(e as Error).message}` };
  }
};

export const rejectHandler: CommandHandler = async (ctx: CommandContext): Promise<CommandResult> => {
  if (!isAdmin(ctx)) return { text: "仅管理员可审批" };
  const ep = dbEp(ctx);
  if (!ep) return { text: "未配置 db" };
  const id = ctx.inbound.text.replace(/^\/?(reject|拒绝)\s*/i, "").trim();
  if (!id) return { text: "用法：拒绝 <申请id>" };
  try {
    const { data } = await postJoinDecide(ep, {
      id,
      decision: "reject",
      decided_by: ctx.inbound.userId,
      as_group_admin: asGroupAdminField(ctx),
    });
    if (data.success === false && data.error === "not_admin") {
      return { text: "无权限（群管需 treat_group_admins_as_admins=true）" };
    }
    return { text: data.success === false ? `失败：${data.error}` : `已拒绝「${data.player_name || id}」` };
  } catch (e) {
    return { text: `失败：${(e as Error).message}` };
  }
};

/** 频道 + 轻量自检（人人可用） */
export const channelHandler: CommandHandler = async (ctx: CommandContext): Promise<CommandResult> => {
  const id = String(ctx.runtimeInfo.bridgeChannelId ?? "").trim();
  const lines: string[] = [
    "【聊天互通】",
    id ? `频道：${id}` : "频道：未配置（请设 qq_config.json → bridge_channel_id 并重启 db/qq/BDS）",
    `后端：${ctx.inbound.backend}${ctx.runtimeInfo.sandbox ? " · sandbox" : ""}`,
  ];
  const ep = dbEp(ctx);
  if (!ep) {
    lines.push("db：未配置 db_host/db_port");
  } else {
    try {
      const st = await fetchSfmcStatus(ep);
      const bds = st.processes?.bds;
      const db = st.processes?.db;
      lines.push(`db-server：${db?.state === "stopped" || db?.running === false ? "未运行" : db?.uptimeText || "可达"}${db?.pid ? ` (PID ${db.pid})` : ""}`);
      lines.push(
        `BDS：${bds?.state === "running" || bds?.running === true ? `运行中 · ${bds.uptimeText || "—"}` : "未运行"}`
      );
    } catch (e) {
      lines.push(`db：不可达（${(e as Error).message}）`);
    }
  }
  lines.push("提示：官方仅 @机器人 的非指令消息进游戏；游戏聊天推群走 MC→QQ。");
  const text = lines.join("\n");
  return {
    text,
    markdown: text
      .split("\n")
      .map((l, i) => (i === 0 ? `## ${l.replace(/【|】/g, "")}` : `- ${l}`))
      .join("\n"),
  };
};

/** 管理侧更完整的自检 */
export const doctorHandler: CommandHandler = async (ctx: CommandContext): Promise<CommandResult> => {
  if (!isAdmin(ctx)) return { text: "仅管理员可执行自检" };
  const base = await channelHandler(ctx);
  const extra: string[] = ["", "【管理自检】"];
  const admins = ctx.runtimeInfo.adminOpenids ?? [];
  extra.push(`管理员 openid 数：${admins.length}${admins.length === 0 ? "（空则无法审批/踢人）" : ""}`);
  extra.push(`群 openid：${ctx.runtimeInfo.groupOpenid ? "已配置" : "未配置"}`);
  if (ctx.inbound.backend === "official") {
    extra.push(`凭证：${ctx.runtimeInfo.officialCreds ? "已注入" : "缺失"}`);
  }
  const text = `${base.text}\n${extra.join("\n")}`;
  return { text, markdown: `${base.markdown ?? base.text}\n\n### 管理自检\n\n${extra.filter(Boolean).map((l) => `- ${l}`).join("\n")}` };
};

export const kickHandler: CommandHandler = async (ctx: CommandContext): Promise<CommandResult> => {
  if (!isAdmin(ctx)) return { text: "仅管理员可踢人（配置 qq_admin_openids）" };
  const ep = dbEp(ctx);
  if (!ep) return { text: "踢人：未配置 db" };
  const target = ctx.inbound.text.replace(/^\/?(踢人|kick)\s*/i, "").trim();
  if (!target) return { text: "用法：踢人 <玩家名>" };
  try {
    const { data } = await postAdminKick(ep, {
      openid: ctx.inbound.userId,
      target_name: target,
      reason: "QQ 管理员踢出",
      as_group_admin: asGroupAdminField(ctx),
    });
    if (!data.success) {
      if (data.error === "not_admin") {
        return { text: "无权限（群管需 treat_group_admins_as_admins=true）" };
      }
      return { text: `踢人入队失败：${data.error || "unknown"}` };
    }
    return { text: `已将「${target}」踢人请求入队，等待 BDS 执行。` };
  } catch (e) {
    return { text: `踢人失败：${(e as Error).message}` };
  }
};

/** 注册内置指令（含运维与绑定 / 入服） */
export function registerBuiltinCommands(registry: CommandRegistry): void {
  registry.register({
    name: "menu",
    aliases: ["菜单", "help", "帮助", "/help", "/菜单", "/menu"],
    description: "显示指令菜单",
    handler: createMenuHandler(registry),
  });
  registry.register({
    name: "ping",
    aliases: ["/ping"],
    description: "连通性探测",
    handler: pingHandler,
  });
  registry.register({
    name: "whoami",
    aliases: ["/whoami", "我的绑定"],
    description: "查看 QQ id 与 MC 绑定",
    handler: whoamiHandler,
  });
  registry.register({
    name: "status",
    aliases: ["状态", "/status", "/状态"],
    description: "服务器状态摘要",
    handler: statusHandler,
  });
  registry.register({
    name: "online",
    aliases: ["在线", "/online", "/在线"],
    description: "在线玩家名单",
    handler: onlineHandler,
  });
  registry.register({
    name: "bind",
    aliases: ["绑定", "/bind", "/绑定"],
    description: "申请 QQ↔MC 绑定码",
    handler: bindHandler,
  });
  registry.register({
    name: "unbind",
    aliases: ["解绑", "/unbind", "/解绑"],
    description: "解除 QQ↔MC 绑定",
    handler: unbindHandler,
  });
  registry.register({
    name: "join",
    aliases: ["申请入服", "/join", "/申请入服"],
    description: "申请加入服务器白名单",
    handler: joinHandler,
  });
  registry.register({
    name: "channel",
    aliases: ["频道", "/channel", "/频道"],
    description: "聊天互通频道与连通自检",
    handler: channelHandler,
  });
  registry.register({
    name: "admin",
    aliases: ["管理", "/admin", "/管理"],
    description: "管理子菜单（管理员）",
    handler: createAdminMenuHandler(registry),
  });
  // —— 以下仅出现在「管理」子菜单；触发词仍可直接调用 ——
  registry.register({
    name: "doctor",
    aliases: ["自检", "/doctor", "/自检"],
    description: "管理侧连通/配置自检",
    handler: doctorHandler,
    adminMenu: true,
  });
  registry.register({
    name: "group",
    aliases: ["群信息", "/group", "/群信息"],
    description: "QQ 群 OpenAPI 摘要",
    handler: groupInfoHandler,
    adminMenu: true,
  });
  registry.register({
    name: "config",
    aliases: ["配置", "入服配置", "/config", "/配置"],
    description: "入服白名单/审批开关（管理员）",
    handler: joinConfigHandler,
    adminMenu: true,
  });
  registry.register({
    name: "pending",
    aliases: ["待审", "/pending", "/待审"],
    description: "待审入服列表（管理员）",
    handler: pendingHandler,
    adminMenu: true,
  });
  registry.register({
    name: "approve",
    aliases: ["通过", "/approve", "/通过"],
    description: "通过入服申请（管理员）",
    handler: approveHandler,
    adminMenu: true,
  });
  registry.register({
    name: "reject",
    aliases: ["拒绝", "/reject", "/拒绝"],
    description: "拒绝入服申请（管理员）",
    handler: rejectHandler,
    adminMenu: true,
  });
  registry.register({
    name: "kick",
    aliases: ["踢人", "/kick", "/踢人"],
    description: "踢出游戏内玩家（管理员）",
    handler: kickHandler,
    adminMenu: true,
  });
}

