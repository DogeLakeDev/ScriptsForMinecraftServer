/**
 * commands/handlers.ts — 内置 menu / ping / whoami / status / online / bind / group
 */

import { getGroupBotState, getGroupInfo } from "@sfmc-bds/sdk/node/qq-official";
import { log } from "../log.js";
import {
  fetchBindMe,
  fetchContent,
  fetchQqEventSettings,
  fetchSfmcStatus,
  postBindRequest,
  postBindUnbind,
  postQqEventSettings,
  type DbEndpoint,
  type QqEventSettings,
  type SfmcStatusResponse,
} from "./db-api.js";
import { formatAccountCard } from "./account-format.js";
import { formatModuleLines, formatPackLines, formatPackMarkdown } from "./content-format.js";
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
      title: "东方犬明湖",
      home: true,
      subtitle: "欢迎回来，今天也一起玩吧 (≧∇≦)ﾉ\n\n查询服务器信息，或管理你的游戏账号。",
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
      subtitle: "管理服务器与群推送。",
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
      subtitle: "查看运行状态、在线玩家和连接方式。",
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
        ? "群内开启「接收所有消息」后可直接发送指令；否则请 @机器人。单聊直接发送。"
        : "直接发送命令，或在菜单打开后 60 秒内回复编号。";
    const sections = [
      ["server", "服务器"],
      ["account", "我的账号"],
      ["admin", "管理"],
    ] as const;
    const lines = [trigger];
    for (const [group, title] of sections) {
      const commands = registry.all().filter((c) => c.group === group && (c.permission !== "admin" || isAdmin(ctx)));
      if (!commands.length) continue;
      lines.push(
        "",
        `【${title}】`,
        ...commands.map((c) => `${c.name === "ip" ? "ip" : c.aliases[0] || c.name}：${c.description}`)
      );
    }
    lines.push("", "发送 菜单 返回首页，发送 取消 取消待确认操作。", "原有英文命令及 /命令 方式仍可使用。");
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
  text: `机器人连接正常，已运行 ${formatUptime(ctx.startedAt)}`,
});

export const whoamiHandler: CommandHandler = async (ctx) => {
  const ep = dbEp(ctx);
  if (!ep) return failure("db 未配置");
  const me = await fetchBindMe(ep, ctx.inbound.userId);
  if (me.success === false) return failure("绑定查询失败");
  return {
    ...formatAccountCard({
      bound: !!me.bound,
      ...(me.binding?.player_name ? { playerName: me.binding.player_name } : {}),
      ...(me.profile ? { profile: me.profile } : {}),
    }),
    buttons: me.bound
      ? [{ id: "unbind", label: "解绑", command: "/unbind" }]
      : [{ id: "bind", label: "绑定", command: "/bind" }],
  };
};

export const statusHandler: CommandHandler = async (ctx) => {
  const ep = dbEp(ctx);
  if (!ep) return failure("db 未配置");
  let st: SfmcStatusResponse;
  try {
    st = await fetchSfmcStatus(ep);
  } catch (error) {
    log.warn(`查服状态接口不可用: ${String(error)}`);
    return formatCard("服务器状态", ["暂时无法连接状态服务，无法确认游戏服务器是否运行。", "请稍后重试或联系管理员。"]);
  }
  const state = st.processes?.bds;
  const running = state?.state === "running" || state?.running === true;
  const stopped = state?.state === "stopped" || state?.running === false;
  const onlineText = stopped
    ? "0 人"
    : st.note || !Array.isArray(st.online)
      ? "数据暂不可确认"
      : `${st.online.length} 人`;
  const age =
    typeof st.updatedAt === "number" ? `${Math.max(0, Math.floor((Date.now() - st.updatedAt) / 1000))} 秒前` : "未知";
  return {
    ...formatCard("服务器状态", [
      `运行状态：${running ? "运行中" : stopped ? "未运行" : "暂时无法确认"}`,
      `在线玩家：${onlineText}`,
      `世界日：${st.world?.day ?? "未知"}`,
      `难度：${st.world?.difficulty ?? "未知"}`,
      `数据更新：${age}`,
      ...(st.note && running ? ["在线数据暂不可确认，请稍后重试。"] : []),
    ]),
    buttons: [
      { id: "online", label: "在线玩家", command: "/online" },
      { id: "version", label: "版本", command: "/version" },
      { id: "ip", label: "连接地址", command: "/ip" },
      { id: "refresh_status", label: "刷新状态", command: "/status" },
    ],
  };
};

export const onlineHandler: CommandHandler = async (ctx) => {
  const ep = dbEp(ctx);
  if (!ep) return failure("db 未配置");
  const st = await fetchSfmcStatus(ep);
  if (st.processes?.bds?.state === "stopped") return formatCard("在线玩家", ["服务器未运行，当前没有在线玩家。"]);
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
    // 未绑定也能进服，但游戏内会被锁成访客；验证码必须在游戏聊天里核销。
    return formatCard("绑定账号", [
      `绑定码：${data.code}`,
      "",
      "进入服务器后完成下面两步：",
      "1. 在游戏内执行 /c:bind",
      "2. 在 60 秒内把以上纯数字验证码发到游戏聊天",
      "",
      "绑定成功后即可自由活动。",
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
    return { text: "群信息仅官方后端可用，且需配置 official.group_openid / 凭证。" };
  }
  return { text: ["QQ 群信息", ...lines].join("\n") };
};

/**
 * 「入服」说明页。
 * 不再走入服申请。玩家直接进服；未绑定为访客且不能移动，绑定写入自有白名单后即可游玩。
 */
export const entryGuideHandler: CommandHandler = (): CommandResult =>
  formatCard("进服说明", [
    "直接进入服务器即可。",
    "",
    "未绑定的角色可以进服，但无法移动，权限为访客。",
    "聊天栏会提示绑定步骤。",
    "在 QQ 发送「绑定」获取验证码，进服后执行 /c:bind，再把验证码发到游戏聊天。",
    "绑定成功后即可正常游玩。",
  ]);

/**
 * 旧的入服申请、审批和白名单开关。
 * 保留这些触发词，让旧按钮和习惯命令有明确回复；不再创建申请，也不再改审批开关。
 */
export const retiredJoinFlowHandler: CommandHandler = (): CommandResult => ({
  text: "入服申请已关闭。直接进入服务器，在游戏内按聊天提示完成绑定后即可游玩。绑定成功会写入白名单并解除访客限制。",
});

const EVENT_SWITCHES = [
  ["enabled", "总开关"],
  ["start", "启动"],
  ["stop", "停服"],
  ["crash", "异常退出"],
  ["join", "上线"],
  ["leave", "下线"],
  ["death", "死亡"],
] as const;

function eventSettingsPanel(settings: QqEventSettings, prefix = ""): CommandResult {
  const rows: Array<[string, string]> = [
    ...EVENT_SWITCHES.map(([field, label]): [string, string] => [label, settings[field] ? "开" : "关"]),
    ["聚合间隔", `${settings.window_sec} 秒`],
  ];
  const textRows = rows.map(([label, value]) => `│ ${label}${"　".repeat(4 - label.length)} │ ${value} │`);
  const buttons = EVENT_SWITCHES.map(([field, label]) => ({
    id: `events_${field}`,
    label: `${label} ${settings[field] ? "关" : "开"}`,
    command: `/events ${label} ${settings[field] ? "关" : "开"}`,
  }));
  buttons.push({ id: "events_window", label: "聚合间隔", command: "/events 间隔" });
  return {
    text: [
      "推送设置",
      ...(prefix ? [prefix] : []),
      "┌──────────┬────────┐",
      "│ 项目　　 │ 状态　 │",
      "├──────────┼────────┤",
      ...textRows,
      "└──────────┴────────┘",
      `玩家事件约 ${settings.window_sec} 秒合并发送；启停与异常退出即时发送。`,
    ].join("\n"),
    markdown: [
      "## 推送设置",
      ...(prefix ? ["", prefix] : []),
      "",
      "| 项目 | 状态 |",
      "| --- | --- |",
      ...rows.map(([label, value]) => `| ${label} | **${value}** |`),
      "",
      `_玩家事件约 ${settings.window_sec} 秒合并发送；启停与异常退出即时发送_`,
    ].join("\n"),
    buttons,
  };
}

export const eventSettingsHandler: CommandHandler = async (ctx): Promise<CommandResult> => {
  if (!isAdmin(ctx)) return { text: "当前没有管理权限，请联系管理员。" };
  const ep = dbEp(ctx);
  if (!ep) return failure("db 未配置");
  const rest = ctx.inbound.text.replace(/^\/?(?:events|事件推送|事件配置)\s*/i, "").trim();
  try {
    if (!rest) {
      const data = await fetchQqEventSettings(ep);
      return data.success && data.settings ? eventSettingsPanel(data.settings) : failure(data.error);
    }
    if (rest === "间隔") {
      const data = await fetchQqEventSettings(ep);
      if (!data.success || !data.settings) return failure(data.error);
      return {
        ...formatCard("聚合间隔", [
          `当前：${data.settings.window_sec} 秒`,
          "玩家进出及死亡通知会在这段时间内合并。",
          "也可发送「事件推送 间隔 秒数」，范围 5–600 秒。",
        ]),
        buttons: [30, 60, 120].map((seconds) => ({
          id: `events_window_${seconds}`,
          label: `${seconds} 秒`,
          command: `/events 间隔 ${seconds}`,
        })),
      };
    }
    const interval = /^间隔\s+(\d+)$/.exec(rest);
    if (interval) {
      const seconds = Number(interval[1]);
      if (!Number.isInteger(seconds) || seconds < 5 || seconds > 600) return { text: "聚合间隔需为 5–600 秒的整数。" };
      const data = await postQqEventSettings(ep, {
        openid: ctx.inbound.userId,
        as_group_admin: asGroupAdminField(ctx),
        field: "window_sec",
        value: seconds,
      });
      return data.success && data.settings ? eventSettingsPanel(data.settings, "已保存") : failure(data.error);
    }
    const match = /^(总开关|启动|停服|异常退出|上线|下线|死亡)\s+(开|关)$/.exec(rest);
    if (!match) return { text: "发送「事件推送」打开开关面板，或选择面板中的操作。" };
    const item = EVENT_SWITCHES.find(([, label]) => label === match[1]);
    if (!item) return { text: "没有这个事件开关。" };
    const [field] = item;
    const value = match[2] === "开";
    const execute: CommandHandler = async (confirmed) => {
      try {
        const data = await postQqEventSettings(ep, {
          openid: confirmed.inbound.userId,
          as_group_admin: asGroupAdminField(confirmed),
          field,
          value,
        });
        return data.success && data.settings ? eventSettingsPanel(data.settings, "已保存") : failure(data.error);
      } catch (error) {
        return failure(error);
      }
    };
    if (field === "enabled" && !value) {
      return {
        text: "确认关闭事件推送",
        confirmation: { summary: "即将关闭全部服务器事件群推送。", execute },
      };
    }
    return execute(ctx);
  } catch (error) {
    return failure(error);
  }
};

/** 频道 + 轻量自检（人人可用） */
export const channelHandler: CommandHandler = () => ({
  text: "QQ群消息进入游戏内只读的 QQ 频道。游戏内各频道可分别设置是否转发到 QQ。",
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
      `QQ 入站频道：${ctx.runtimeInfo.bridgeChannelId || "qq"}`,
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

/** 查询已安装模块。可加关键字，例如「模块 聊天」。 */
export const modulesHandler: CommandHandler = async (ctx) => {
  const ep = dbEp(ctx);
  if (!ep) return failure("db 未配置");
  const keyword = ctx.inbound.text.replace(/^\/?(模块|modules)\s*/i, "").trim();
  try {
    const data = await fetchContent(ep);
    if (data.success === false) return failure(data.error);
    return formatCard("模块", formatModuleLines(data.modules ?? [], keyword));
  } catch (error) {
    return failure(error);
  }
};

/** 查询世界已安装的行为包和资源包。旧快照没有 packs 时，把已启用资源包当作资源包段。 */
export const packsHandler: CommandHandler = async (ctx) => {
  const ep = dbEp(ctx);
  if (!ep) return failure("db 未配置");
  try {
    const data = await fetchContent(ep);
    if (data.success === false) return failure(data.error);
    const packs =
      data.packs ??
      (data.resource_packs ?? []).map((pack) => ({
        kind: "resource" as const,
        enabled: true,
        ...(pack.name ? { name: pack.name } : {}),
        ...(pack.pack_id ? { pack_id: pack.pack_id } : {}),
        ...(pack.version ? { version: pack.version } : {}),
      }));
    return {
      text: ["世界包", "", ...formatPackLines(packs, data.note)].join("\n"),
      markdown: formatPackMarkdown(packs, data.note),
    };
  } catch (error) {
    return failure(error);
  }
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
  add(
    "server",
    ["服务器"],
    "查看运行状态、在线玩家和连接方式",
    sectionHandler(registry, "server", "服务器信息"),
    "home"
  );
  add("account", ["我的账号"], "查看与管理游戏角色绑定", whoamiHandler, "home");
  add(
    "entry",
    ["入服"],
    "直接进服，游戏内绑定后即可游玩",
    entryGuideHandler,
    "home"
  );
  add("help", ["帮助"], "查看使用说明和常用命令", helpHandler(registry), "home");
  add("admin", ["管理"], "管理菜单", createAdminMenuHandler(registry), "home", true);
  add("status", ["查服", "状态"], "服务器运行状态", statusHandler, "server");
  add("online", ["在线"], "完整在线名单", onlineHandler, "server");
  add("version", ["版本"], "基岩版入服版本", serverVersionHandler, "server");
  add("ip", ["地址"], "公开服务器地址与端口", serverAddressHandler, "server");
  add("modules", ["模块"], "查看已安装模块", modulesHandler, "server");
  add("packs", ["资源包", "行为包", "世界包"], "查看世界行为包和资源包", packsHandler, "server");
  add("channel", ["频道"], "聊天互通状态", channelHandler, "server");
  add("ping", [], "机器人连通性", pingHandler, "server");
  add("whoami", ["我的绑定"], "查看绑定角色", whoamiHandler, "account");
  add("bind", ["绑定"], "申请绑定验证码", bindHandler, "account");
  add("unbind", ["解绑"], "确认解除绑定", unbindHandler, "account");
  add(
    "join",
    ["申请入服", "通过", "拒绝", "待审", "approve", "reject", "pending", "配置", "入服配置", "config"],
    "入服申请已关闭，请直接进服并绑定",
    retiredJoinFlowHandler,
    "help"
  );
  add("doctor", ["自检"], "连通与运行诊断", doctorHandler, "admin", true);
  add("group", ["群信息"], "官方 QQ 群信息", groupInfoHandler, "admin", true);
  add("events", ["事件推送", "事件配置"], "服务器事件推送开关", eventSettingsHandler, "admin", true);
}
