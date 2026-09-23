/**
 * commands/handlers.ts — 内置 menu / ping / whoami / status / online / bind / join / kick / group
 */

import { getGroupBotState, getGroupInfo, sendC2cMessage, sendGroupMessage } from "@sfmc-bds/sdk/node/qq-official";
import { log } from "../log.js";
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
import { formatCard, formatCommandMenu } from "./menu-format.js";
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
  return ctx.adminAuthorized === true;
}

function failure(error: unknown): CommandResult {
  log.warn(`QQ 操作失败: ${String(error)}`);
  return { text: "操作暂时未完成，请稍后查询状态或联系管理员；请勿连续重复提交修改。" };
}

function asGroupAdminField(ctx: CommandContext): boolean {
  return ctx.inbound.isGroupAdmin === true;
}

/** 拉取官方群 info + bot_state；失败返回提示行 */
async function fetchQqGroupLines(ctx: CommandContext): Promise<string[]> {
  const creds = ctx.runtimeInfo.officialCreds;
  const gid = ctx.runtimeInfo.groupOpenid || (ctx.inbound.scene !== "c2c" ? ctx.inbound.groupId : "");
  if (!creds || !gid || ctx.inbound.backend !== "official") return [];
  const lines: string[] = [];
  try {
    const [infoRes, stateRes] = await Promise.all([getGroupInfo(creds, gid), getGroupBotState(creds, gid)]);
    if (infoRes.ok && infoRes.json && typeof infoRes.json === "object") {
      const j = infoRes.json as Record<string, unknown>;
      lines.push(`QQ群：${j["group_name"] ?? "—"} · 成员 ${j["group_member_num"] ?? "—"}`);
    } else if (!infoRes.ok) {
      const hint = /11253/.test(infoRes.error || infoRes.body || "")
        ? "群信息接口未开通白名单(11253)"
        : `群信息失败：${(infoRes.error || "").slice(0, 60)}`;
      lines.push(hint);
    }
    if (stateRes.ok && stateRes.json && typeof stateRes.json === "object") {
      const j = stateRes.json as Record<string, unknown>;
      lines.push(
        `机器人：角色=${j["member_role"] ?? "—"} · 主动推送=${j["allow_proactive_msg"] === true ? "开" : "关"} · 收消息=${j["recv_msg_setting"] ?? "—"}`
      );
    }
  } catch (e) {
    lines.push(`群信息异常：${(e as Error).message}`);
  }
  return lines;
}

export function createMenuHandler(registry: CommandRegistry): CommandHandler {
  return (ctx) =>
    formatCommandMenu({
      title: "玩家服务",
      home: true,
      subtitle: "从这里查看服务器、管理账号或申请入服。",
      cmds: registry
        .all()
        .filter((c) => c.group === "home" && c.name !== "menu" && (c.permission !== "admin" || isAdmin(ctx))),
      idPrefix: "home",
      footerMd: "",
      footerText: "",
    });
}

export function createAdminMenuHandler(registry: CommandRegistry): CommandHandler {
  return (ctx) => {
    if (!isAdmin(ctx)) return { text: "当前没有管理权限，请联系管理员。" };
    return formatCommandMenu({
      title: "服务器管理",
      subtitle: "选择管理操作：",
      cmds: registry.adminMenu(),
      idPrefix: "admin",
      footerMd: "",
      footerText: "",
    });
  };
}

function sectionHandler(registry: CommandRegistry, group: "server", title: string): CommandHandler {
  return () =>
    formatCommandMenu({
      title,
      subtitle: "也可以直接发送以下命令。",
      cmds: registry.all().filter((c) => c.group === group),
      idPrefix: group,
      footerMd: "",
      footerText: "",
    });
}

function helpHandler(registry: CommandRegistry): CommandHandler {
  return (ctx) => {
    const trigger =
      ctx.inbound.backend === "official"
        ? "群内 @机器人 后发送命令，或点击按钮；单聊直接发送命令。"
        : "直接发送命令，或在菜单打开后 60 秒内回复编号。";
    const sections = [
      ["server", "服务器"],
      ["account", "我的账号"],
      ["join", "入服"],
      ["admin", "管理"],
    ] as const;
    const lines = [trigger];
    for (const [group, title] of sections) {
      const commands = registry.all().filter((c) => c.group === group && (c.permission !== "admin" || isAdmin(ctx)));
      if (!commands.length) continue;
      lines.push(
        "",
        `【${title}】`,
        ...commands.map((c) => `${c.name === "ip" ? "ip" : c.aliases[0] || c.name} · ${c.description}`)
      );
    }
    lines.push("", "发送「菜单」返回首页，发送「取消」取消待确认操作。", "原有英文命令及 /命令 方式仍可使用。");
    return formatCard("使用帮助", lines);
  };
}

export const serverVersionHandler: CommandHandler = async (ctx) => {
  const ep = dbEp(ctx);
  if (ep) {
    try {
      const status = await fetchSfmcStatus(ep);
      const bds = status.processes?.bds;
      if (bds?.state === "running" && bds.version)
        return formatCard("版本", ["游戏类型：基岩版", `当前 BDS 版本：${bds.version}`]);
    } catch (error) {
      log.warn(`BDS 版本查询失败: ${String(error)}`);
    }
  }
  return {
    text: ctx.runtimeInfo.publicServer?.version
      ? `暂时无法确认实际 BDS 版本。\n管理员提供的入服说明：${ctx.runtimeInfo.publicServer.version}`
      : "暂时无法确认实际 BDS 版本，请联系管理员确认入服版本。",
  };
};
export const serverAddressHandler: CommandHandler = (ctx) => {
  const info = ctx.runtimeInfo.publicServer;
  return formatCard(
    "连接地址",
    info?.address
      ? [
          "游戏类型：基岩版",
          `服务器地址：${info.address}`,
          `端口：${info.port ?? 19132}`,
          "",
          "在游戏内选择「添加服务器」，填写以上信息。",
        ]
      : ["暂未公布服务器地址，请联系管理员获取。"]
  );
};

export const pingHandler: CommandHandler = (ctx) => ({
  text: `机器人连接正常 · 已运行 ${formatUptime(ctx.startedAt)}`,
});

export const whoamiHandler: CommandHandler = async (ctx) => {
  const ep = dbEp(ctx);
  if (!ep) return failure("db 未配置");
  const me = await fetchBindMe(ep, ctx.inbound.userId);
  if (me.success === false) return failure("绑定查询失败");
  return {
    ...formatCard(
      "我的账号",
      me.bound
        ? ["绑定状态：已绑定", `游戏角色：${me.binding?.player_name || "未命名角色"}`]
        : ["绑定状态：未绑定", "选择「绑定」获取验证码，再在游戏内执行 /c:bind。"]
    ),
    buttons: me.bound
      ? [{ id: "unbind", label: "解绑", command: "/unbind" }]
      : [{ id: "bind", label: "绑定", command: "/bind" }],
  };
};

export const statusHandler: CommandHandler = async (ctx) => {
  const ep = dbEp(ctx);
  if (!ep) return failure("db 未配置");
  const st = await fetchSfmcStatus(ep);
  const state = st.processes?.bds;
  const running = state?.state === "running" || state?.running === true;
  const stopped = state?.state === "stopped" || state?.running === false;
  const age =
    typeof st.updatedAt === "number" ? `${Math.max(0, Math.floor((Date.now() - st.updatedAt) / 1000))} 秒前` : "未知";
  return {
    ...formatCard("查服", [
      `运行：${running ? "运行中" : stopped ? "未运行" : "暂时无法确认"}`,
      `在线：${st.note || !Array.isArray(st.online) ? "数据暂不可确认" : `${st.online.length} 人`}`,
      `世界日：${st.world?.day ?? "未知"}`,
      `难度：${st.world?.difficulty ?? "未知"}`,
      `数据更新：${age}`,
      ...(st.note ? ["在线数据暂不可确认，请稍后重试。"] : []),
    ]),
    buttons: [
      { id: "online", label: "在线玩家", command: "/online" },
      { id: "version", label: "版本", command: "/version" },
      { id: "ip", label: "ip", command: "/ip" },
    ],
  };
};

export const onlineHandler: CommandHandler = async (ctx) => {
  const ep = dbEp(ctx);
  if (!ep) return failure("db 未配置");
  const st = await fetchSfmcStatus(ep);
  if (!Array.isArray(st.online) || st.note) return { text: "在线数据暂不可确认，请稍后重试。" };
  if (!st.online.length) return formatCard("在线玩家", ["当前没有在线玩家。"]);
  return {
    ...formatCard("在线玩家", [
      `当前在线 ${st.online.length} 人`,
      "",
      ...st.online.map((p, i) => `${i + 1}. ${p.name || "未命名玩家"}`),
    ]),
  };
};

export const bindHandler: CommandHandler = async (ctx: CommandContext): Promise<CommandResult> => {
  const ep = dbEp(ctx);
  if (!ep) return failure("db 未配置");
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
      return failure(data.error);
    }
    return formatCard("绑定账号", [
      `绑定码：${data.code}`,
      "",
      "1. 在游戏内执行 /c:bind",
      "2. 在 60 秒内发送以上纯数字验证码",
      "",
      "超时请重新发送「绑定」获取验证码。",
    ]);
  } catch (e) {
    return failure(e);
  }
};

export const unbindHandler: CommandHandler = async (ctx) => {
  const ep = dbEp(ctx);
  if (!ep) return failure("db 未配置");
  const me = await fetchBindMe(ep, ctx.inbound.userId);
  if (me.success === false) return failure("绑定查询失败");
  if (!me.bound || !me.binding) return { text: "当前没有绑定记录。" };
  const original = me.binding;
  return {
    text: "确认解绑",
    confirmation: {
      summary: `即将解除你与「${original.player_name || "未命名角色"}」的绑定。之后需要重新申请验证码才能绑定。`,
      execute: async (confirmed) => {
        const current = await fetchBindMe(ep, confirmed.inbound.userId);
        if (current.success === false) return failure("绑定核验失败");
        if (
          !current.bound ||
          current.binding?.player_xuid !== original.player_xuid ||
          current.binding?.bound_at !== original.bound_at
        ) {
          return { text: "绑定状态已变化，请重新查询「我的账号」后再操作。" };
        }
        const { data } = await postBindUnbind(ep, { openid: confirmed.inbound.userId });
        if (data.success === false) return failure(data.error);
        return { text: data.unbound ? "已解除 QQ 与游戏角色的绑定。" : "当前没有绑定记录。" };
      },
    },
  };
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
  if (!ep) return failure("db 未配置");
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
        return { text: "当前未开放入服申请，请联系管理员了解入服方式。" };
      }
      return failure(data.error);
    }
    if (data.auto_approved || data.status === "approved") {
      return {
        text: `「${playerName}」已自动审核通过，等待服务器写入白名单。`,
      };
    }
    const admins = ctx.runtimeInfo.adminOpenids ?? [];
    const creds = ctx.runtimeInfo.officialCreds;
    const gid = ctx.runtimeInfo.groupOpenid || (ctx.inbound.scene !== "c2c" ? ctx.inbound.groupId : "");
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
      })
        .then((result) => {
          if (!result.ok) log.warn(`入服申请通知失败: ${result.error}`);
        })
        .catch((error) => log.warn(`入服申请通知失败: ${String(error)}`));
    }
    const note = "\n请等待管理员审核；审核通过后仍需服务器写入白名单。";
    return {
      text: `已提交入服申请「${playerName}」${note}`,
    };
  } catch (e) {
    return failure(e);
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
  if (!ep) return failure("db 未配置");

  const admins = ctx.runtimeInfo.adminOpenids ?? [];
  const rest = ctx.inbound.text.replace(/^\/?(配置|config|入服配置)\s*/i, "").trim();
  if (!rest) {
    try {
      const data = await fetchJoinSettings(ep);
      if (data.success === false) return failure(data.error);
      return buildJoinSettingsPanel({
        settings: settingsFromResponse(data),
        backend: ctx.inbound.backend,
        adminOpenids: admins,
      });
    } catch (e) {
      return failure(e);
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

  const execute: CommandHandler = async (confirmed) => {
    try {
      const { data } = await postJoinSettings(ep, { ...body, as_group_admin: asGroupAdminField(confirmed) });
      if (data.success === false) {
        if (data.error === "not_admin") {
          return { text: "无权限（群管需 configs/qq_link.json 中 treat_group_admins_as_admins=true）" };
        }
        if (data.error === "immutable_field") {
          return { text: data.note || "该字段不可经群聊修改" };
        }
        return failure(data.error);
      }
      return buildJoinSettingsPanel({
        settings: settingsFromResponse(data),
        backend: ctx.inbound.backend,
        adminOpenids: admins,
        prefix: "已保存",
      });
    } catch (e) {
      return failure(e);
    }
  };
  if (!onOff)
    return {
      text: "确认修改入服设置",
      confirmation: {
        summary:
          which === "白名单" || which === "allowlist"
            ? "即将关闭入服白名单功能，新的入服申请与白名单应用将停止。此操作不会直接修改 BDS 原生白名单。"
            : "即将关闭人工审批，后续入服申请将自动通过。",
        execute,
      },
    };
  return execute(ctx);
};

export const pendingHandler: CommandHandler = async (ctx: CommandContext): Promise<CommandResult> => {
  if (!isAdmin(ctx)) return { text: "仅管理员可查看待审列表（配置 qq_admin_openids）" };
  const ep = dbEp(ctx);
  if (!ep) return failure("db 未配置");
  try {
    const data = await fetchJoinPending(ep, ctx.inbound.userId, asGroupAdminField(ctx));
    if (data.error) {
      if (data.error === "not_admin") {
        return { text: "无权限（群管需 treat_group_admins_as_admins=true）" };
      }
      return failure(data.error);
    }
    const list = data.pending ?? [];
    if (list.length === 0) return { text: "暂无待审入服申请" };
    const lines = list.map((r, i) => `${i + 1}. ${r.player_name || "?"} (${r.id})`);
    return { text: `待审 ${list.length} 条\n${lines.join("\n")}` };
  } catch (e) {
    return failure(e);
  }
};

async function notifyApplicant(ctx: CommandContext, applicant: string | undefined, text: string): Promise<void> {
  if (ctx.inbound.backend !== "official" || !ctx.runtimeInfo.officialCreds || !applicant) return;
  try {
    const result = await sendC2cMessage(ctx.runtimeInfo.officialCreds, { userOpenid: applicant, content: text });
    if (!result.ok) log.warn(`申请结果通知失败: ${result.error}`);
  } catch (error) {
    log.warn(`申请结果通知失败: ${String(error)}`);
  }
}

export const approveHandler: CommandHandler = async (ctx: CommandContext): Promise<CommandResult> => {
  if (!isAdmin(ctx)) return { text: "仅管理员可审批" };
  const ep = dbEp(ctx);
  if (!ep) return failure("db 未配置");
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
    if (data.success === true)
      await notifyApplicant(
        ctx,
        data.applicant_openid,
        `你的入服申请「${data.player_name || id}」已审核通过，等待服务器写入白名单。`
      );
    return {
      text:
        data.success !== true
          ? "操作未完成，申请可能已被处理，请刷新待审列表。"
          : `已审核通过「${data.player_name || id}」，等待服务器写入白名单。`,
    };
  } catch (e) {
    return failure(e);
  }
};

export const rejectHandler: CommandHandler = async (ctx: CommandContext): Promise<CommandResult> => {
  if (!isAdmin(ctx)) return { text: "仅管理员可审批" };
  const ep = dbEp(ctx);
  if (!ep) return failure("db 未配置");
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
    if (data.success === true)
      await notifyApplicant(
        ctx,
        data.applicant_openid,
        `你的入服申请「${data.player_name || id}」已被拒绝，请联系管理员了解原因。`
      );
    return {
      text:
        data.success !== true
          ? "操作未完成，申请可能已被处理，请刷新待审列表。"
          : `已拒绝「${data.player_name || id}」`,
    };
  } catch (e) {
    return failure(e);
  }
};

/** 频道 + 轻量自检（人人可用） */
export const channelHandler: CommandHandler = (ctx) => ({
  text: ctx.runtimeInfo.bridgeChannelId
    ? "聊天互通已配置。群内普通聊天按当前互通规则发送到游戏。"
    : "聊天互通尚未开启，请联系管理员。",
});

export const doctorHandler: CommandHandler = async (ctx) => {
  if (!isAdmin(ctx)) return { text: "当前没有管理权限。" };
  const ep = dbEp(ctx);
  if (!ep) return failure("db 未配置");
  const st = await fetchSfmcStatus(ep);
  const qq = await fetchQqGroupLines(ctx);
  return {
    text: [
      "管理自检",
      `后端：${ctx.inbound.backend}`,
      `互通频道：${ctx.runtimeInfo.bridgeChannelId || "未配置"}`,
      `主机：${st.host?.hostname || "未知"} · ${st.host?.platform || "未知"}`,
      `CPU：${st.host?.cpu?.model || "未知"} · ${st.host?.cpu?.cores ?? "未知"} 核`,
      `内存：${st.host?.memory?.usedMb ?? "未知"}/${st.host?.memory?.totalMb ?? "未知"} MB`,
      `主机运行：${st.host?.uptimeText || "未知"}`,
      `BDS：${st.processes?.bds?.state || "未知"} · PID ${st.processes?.bds?.pid ?? "未知"} · ${st.processes?.bds?.uptimeText || "未知"}`,
      `数据库：PID ${st.processes?.db?.pid ?? "未知"} · ${st.processes?.db?.uptimeText || "未知"}`,
      ...qq,
    ].join("\n"),
  };
};

export const kickHandler: CommandHandler = async (ctx: CommandContext): Promise<CommandResult> => {
  if (!isAdmin(ctx)) return { text: "仅管理员可踢人（配置 qq_admin_openids）" };
  const ep = dbEp(ctx);
  if (!ep) return failure("db 未配置");
  const target = ctx.inbound.text.replace(/^\/?(踢人|kick)\s*/i, "").trim();
  if (!target) return { text: "用法：踢人 <玩家名>" };
  const execute: CommandHandler = async (confirmed) => {
    try {
      const { data } = await postAdminKick(ep, {
        openid: ctx.inbound.userId,
        target_name: target,
        reason: "QQ 管理员踢出",
        as_group_admin: asGroupAdminField(confirmed),
      });
      if (!data.success) {
        if (data.error === "not_admin") {
          return { text: "无权限（群管需 treat_group_admins_as_admins=true）" };
        }
        return failure(data.error);
      }
      return { text: `已将「${target}」踢人请求入队，等待 BDS 执行。` };
    } catch (e) {
      return failure(e);
    }
  };
  return { text: "确认踢人", confirmation: { summary: `即将把「${target}」踢出游戏；对方仍可重新连接。`, execute } };
};

/** 注册表同时驱动菜单、帮助和权限。 */
export function registerBuiltinCommands(registry: CommandRegistry): void {
  const add = (
    name: string,
    aliases: string[],
    description: string,
    handler: CommandHandler,
    group: "home" | "server" | "account" | "join" | "help" | "admin",
    admin = false
  ) =>
    registry.register({
      name,
      aliases,
      description,
      handler,
      group,
      permission: admin ? "admin" : "player",
      adminMenu: group === "admin",
    });
  add("menu", ["菜单"], "返回首页", createMenuHandler(registry), "home");
  add("server", ["服务器"], "查服 · 在线 · 版本 · IP", sectionHandler(registry, "server", "服务器"), "home");
  add("account", ["我的账号"], "查看绑定 · 绑定账号 · 解绑", whoamiHandler, "home");
  add(
    "entry",
    ["入服"],
    "申请方式 · 提交入服申请",
    () => ({
      ...formatCard("入服", [
        "发送：申请入服 你的游戏名",
        "已绑定角色可直接发送「申请入服」。",
        "",
        "提交申请 → 审核通过 → 服务器写入白名单",
        "请按回复提示等待，审核通过不代表已经生效。",
      ]),
      buttons: [{ id: "join", label: "申请入服", command: "/join" }],
    }),
    "home"
  );
  add("help", ["帮助"], "使用说明 · 常用命令", helpHandler(registry), "home");
  add("admin", ["管理"], "管理菜单", createAdminMenuHandler(registry), "home", true);
  add("status", ["查服", "状态"], "服务器运行状态", statusHandler, "server");
  add("online", ["在线"], "完整在线名单", onlineHandler, "server");
  add("version", ["版本"], "基岩版入服版本", serverVersionHandler, "server");
  add("ip", ["地址"], "公开服务器地址与端口", serverAddressHandler, "server");
  add("channel", ["频道"], "聊天互通状态", channelHandler, "server");
  add("ping", [], "机器人连通性", pingHandler, "server");
  add("whoami", ["我的绑定"], "查看绑定角色", whoamiHandler, "account");
  add("bind", ["绑定"], "申请绑定验证码", bindHandler, "account");
  add("unbind", ["解绑"], "确认解除绑定", unbindHandler, "account");
  add("join", ["申请入服"], "申请入服 <游戏名>", joinHandler, "join");
  add("doctor", ["自检"], "连通与运行诊断", doctorHandler, "admin", true);
  add("group", ["群信息"], "官方 QQ 群信息", groupInfoHandler, "admin", true);
  add("config", ["配置", "入服配置"], "入服白名单与审批设置", joinConfigHandler, "admin", true);
  add("pending", ["待审"], "待审申请列表", pendingHandler, "admin", true);
  add("approve", ["通过"], "通过 <申请ID>", approveHandler, "admin", true);
  add("reject", ["拒绝"], "拒绝 <申请ID>", rejectHandler, "admin", true);
  add("kick", ["踢人"], "踢人 <玩家名>", kickHandler, "admin", true);
}
