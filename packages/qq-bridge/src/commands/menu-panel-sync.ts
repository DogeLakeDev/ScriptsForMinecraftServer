/**
 * commands/menu-panel-sync.ts — CommandRegistry → 官方菜单 / 群指令面板
 *
 * 官方契约（autogen）：
 *   PUT  /v2/menu            body: { menu: { items } }
 *   POST /v2/panels          body: { scope, target_type?, group_openids?, panel: { items, remark? } }
 *   PUT  /v2/panels/{id}     body: { panel: { items, remark? } }
 */

import {
  createPanel,
  putMenu,
  updatePanel,
  updatePanelTarget,
  type QqMenuItem,
  type QqOfficialCredentials,
  type QqPanelItem,
} from "@sfmc-bds/sdk/node/qq-official";
import { patchJson } from "@sfmc-bds/sdk/node/config";
import { log } from "../log.js";
import { CFG_PATH } from "../config.js";
import type { CommandRegistry } from "./registry.js";
import type { RegisteredCommand } from "./types.js";

const MAX_MENU_ITEMS = 10;
const MAX_PANEL_ITEMS = 20;

export type MenuPanelSyncOpts = {
  creds: QqOfficialCredentials;
  registry: CommandRegistry;
  groupOpenid: string;
  /** 已有面板 id；空则 POST 新建 */
  panelId: string;
  /** sync 成功后写回 panel id */
  persistPanelId?: (panelId: string) => void;
};

/** 选一个适合展示/填入输入框的短触发词（优先中文别名） */
function pickTriggerLabel(cmd: RegisteredCommand, maxChars: number): string {
  const candidates = [cmd.name, ...cmd.aliases]
    .map((a) => String(a ?? "").replace(/^[/／]+/, "").trim())
    .filter((a) => a.length > 0);
  const preferred =
    candidates.find((a) => /[\u4e00-\u9fff]/.test(a)) ?? candidates.find((a) => !a.startsWith("/")) ?? candidates[0] ?? cmd.name;
  return preferred.slice(0, maxChars);
}

/** 从 registry 生成 C2C 菜单项（send_message） */
export function buildMenuItems(registry: CommandRegistry): QqMenuItem[] {
  return registry
    .all()
    .slice(0, MAX_MENU_ITEMS)
    .map((c) => {
      const label = pickTriggerLabel(c, 10);
      return {
        type: "send_message" as const,
        name: label,
        // 点击后填入输入框；与 router 触发词对齐
        send_message: `/${c.name}`,
      };
    });
}

/**
 * 从 registry 生成群指令面板项。
 * 官方：type=command 时点击后把 name 填入输入框（无独立 command 字段）。
 */
export function buildPanelItems(registry: CommandRegistry): QqPanelItem[] {
  return registry
    .all()
    .slice(0, MAX_PANEL_ITEMS)
    .map((c) => ({
      type: "command" as const,
      // 填入输入框的内容：用 /name 便于 router 命中
      name: `/${c.name}`.slice(0, 14),
      desc: (c.description || c.name).slice(0, 30),
    }));
}

function extractPanelId(json: unknown): string {
  if (!json || typeof json !== "object") return "";
  const o = json as Record<string, unknown>;
  for (const key of ["panel_id", "id", "panelId"]) {
    const v = o[key];
    if (typeof v === "string" && v.length > 0) return v;
  }
  if (o["data"] && typeof o["data"] === "object") {
    return extractPanelId(o["data"]);
  }
  return "";
}

/**
 * 同步自定义菜单 + 群指令面板。失败只打日志，不抛给调用方。
 */
export async function syncMenuAndPanel(opts: MenuPanelSyncOpts): Promise<{ menuOk: boolean; panelOk: boolean }> {
  const items = buildMenuItems(opts.registry);
  const panelItems = buildPanelItems(opts.registry);
  let menuOk = false;
  let panelOk = false;

  const menuRes = await putMenu(opts.creds, { menu: { items } });
  if (menuRes.ok) {
    menuOk = true;
    log.info(`官方自定义菜单已同步 (${items.length} 项)`);
  } else {
    log.warn(`官方自定义菜单同步失败: ${menuRes.error}`);
  }

  const panelBody = {
    items: panelItems,
    remark: "SFMC",
  };

  let panelId = opts.panelId.trim();
  if (panelId) {
    const upd = await updatePanel(opts.creds, panelId, { panel: panelBody });
    if (upd.ok) {
      panelOk = true;
      log.info(`官方群指令面板已更新 id=${panelId}`);
    } else {
      log.warn(`官方群指令面板更新失败，将尝试新建: ${upd.error}`);
      panelId = "";
    }
  }

  if (!panelId) {
    const hasGroup = !!opts.groupOpenid;
    const created = await createPanel(opts.creds, {
      scope: "group",
      target_type: hasGroup ? "specific" : "all",
      ...(hasGroup ? { group_openids: [opts.groupOpenid] } : {}),
      panel: panelBody,
    });
    if (created.ok) {
      panelId = extractPanelId(created.json) || extractPanelId(safeParse(created.body));
      if (panelId) {
        panelOk = true;
        opts.persistPanelId?.(panelId);
        log.info(`官方群指令面板已创建 id=${panelId}`);
      } else {
        log.warn(`官方群指令面板创建成功但未解析到 id: ${created.body.slice(0, 160)}`);
        panelOk = true;
      }
    } else {
      log.warn(`官方群指令面板创建失败: ${created.error}`);
    }
  }

  // create 时已带 group_openids；仅当后续更新场景或 create 未带群时再关联
  if (panelOk && panelId && opts.groupOpenid) {
    const tgt = await updatePanelTarget(opts.creds, panelId, {
      op: "add",
      group_openids: [opts.groupOpenid],
    });
    if (!tgt.ok) {
      // specific 面板重复 add 或 all 面板会失败；降级为 debug 级 warn
      log.warn(`官方面板关联群跳过/失败: ${tgt.error}`);
    }
  }

  return { menuOk, panelOk };
}

function safeParse(body: string): unknown {
  try {
    return JSON.parse(body) as unknown;
  } catch {
    return null;
  }
}

/** 默认：把 panel id 浅合并写回 qq_config.json */
export function persistPanelIdToConfig(panelId: string): void {
  try {
    patchJson(CFG_PATH, { qq_group_panel_id: panelId });
  } catch (e) {
    log.warn(`写回 qq_group_panel_id 失败: ${(e as Error).message}`);
  }
}
