/**
 * commands/join-settings-ui.ts — 入服配置面板文案与互动按钮（DRY）
 *
 * official：INTERACTION 回调 data = cfg:allowlist|approval:on|off
 * llbot：编号会话 command = 「配置 白名单/审批 开|关」
 */

import type { JoinSettingsResponse } from "./db-api.js";
import type { CommandButton, CommandResult, QqBackendKind } from "./types.js";

export type JoinSettingsView = {
  allowlist_enabled?: boolean;
  require_approval?: boolean;
  treat_group_admins_as_admins?: boolean;
};

function onOffLabel(on: boolean): string {
  return on ? "开" : "关";
}

/** 纯文本摘要（llbot / 降级） */
export function formatJoinSettingsText(s: JoinSettingsView, prefix = ""): string {
  const al = onOffLabel(s.allowlist_enabled !== false);
  const ap = onOffLabel(s.require_approval !== false);
  const ga = onOffLabel(s.treat_group_admins_as_admins === true);
  const head = prefix ? `${prefix}\n` : "";
  return (
    `${head}入服插件配置（configs/qq_link.json）\n` +
    `· 白名单：${al}\n` +
    `· 审批：${ap}\n` +
    `· 群管视作管理员：${ga}（只读，改文件）`
  );
}

export function formatJoinSettingsMarkdown(s: JoinSettingsView, prefix?: string): string {
  const al = onOffLabel(s.allowlist_enabled !== false);
  const ap = onOffLabel(s.require_approval !== false);
  const ga = onOffLabel(s.treat_group_admins_as_admins === true);
  const lines = [
    "## 入服配置",
    ...(prefix ? ["", prefix] : []),
    "",
    `| 项 | 状态 |`,
    `| --- | --- |`,
    `| 白名单 | **${al}** |`,
    `| 审批 | **${ap}** |`,
    `| 群管视作管理员 | ${ga}（只读） |`,
    "",
    "_点按钮切换白名单/审批；群管开关请改配置文件_",
  ];
  return lines.join("\n");
}

/**
 * 生成切换按钮：展示「点一下变成的目标状态」。
 * official 用回调；llbot 用文本命令。
 */
export function buildJoinSettingsButtons(
  s: JoinSettingsView,
  backend: QqBackendKind,
  adminOpenids: string[] = []
): CommandButton[] {
  const alOn = s.allowlist_enabled !== false;
  const apOn = s.require_approval !== false;
  // 点一下切到反状态
  const alTarget = !alOn;
  const apTarget = !apOn;
  const alWord = alTarget ? "开" : "关";
  const apWord = apTarget ? "开" : "关";

  const permission =
    adminOpenids.length > 0
      ? { type: 0 as const, specify_user_ids: adminOpenids }
      : { type: 2 as const };

  if (backend === "official") {
    return [
      {
        id: "cfg_al",
        label: `白名单·${alWord}`,
        command: `cfg:allowlist:${alTarget ? "on" : "off"}`,
        actionType: 1,
        style: alTarget ? 1 : 0,
        visitedLabel: `白名单·${alWord}`,
        permission,
      },
      {
        id: "cfg_ap",
        label: `审批·${apWord}`,
        command: `cfg:approval:${apTarget ? "on" : "off"}`,
        actionType: 1,
        style: apTarget ? 1 : 0,
        visitedLabel: `审批·${apWord}`,
        permission,
      },
    ];
  }

  return [
    {
      id: "cfg_al",
      label: `白名单 ${alWord}`,
      command: `配置 白名单 ${alWord}`,
    },
    {
      id: "cfg_ap",
      label: `审批 ${apWord}`,
      command: `配置 审批 ${apWord}`,
    },
  ];
}

export function buildJoinSettingsPanel(opts: {
  settings: JoinSettingsView;
  backend: QqBackendKind;
  adminOpenids?: string[];
  /** 如「已保存」 */
  prefix?: string;
}): CommandResult {
  const { settings, backend, adminOpenids = [], prefix } = opts;
  const text = formatJoinSettingsText(settings, prefix);
  return {
    text,
    markdown: formatJoinSettingsMarkdown(settings, prefix),
    buttons: buildJoinSettingsButtons(settings, backend, adminOpenids),
  };
}

/** 解析 cfg:allowlist|approval:on|off */
export function parseCfgInteractionData(
  data: string
): { field: "allowlist_enabled" | "require_approval"; value: boolean } | null {
  const m = /^cfg:(allowlist|approval):(on|off|true|false|1|0)$/i.exec(data.trim());
  if (!m) return null;
  const field = m[1]!.toLowerCase() === "allowlist" ? "allowlist_enabled" : "require_approval";
  const raw = m[2]!.toLowerCase();
  const value = raw === "on" || raw === "true" || raw === "1";
  return { field, value };
}

export function settingsFromResponse(data: JoinSettingsResponse): JoinSettingsView {
  return {
    allowlist_enabled: data.allowlist_enabled,
    require_approval: data.require_approval,
    treat_group_admins_as_admins: data.treat_group_admins_as_admins,
  };
}
