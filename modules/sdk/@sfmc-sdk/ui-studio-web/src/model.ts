/**
 * model.ts — Studio 前端的文档模型工具。
 *
 * 节点定位统一使用「段路径」：body/0、body/2/content/1、body/1/template/0 …
 * 与校验诊断中的 JSON Pointer（/pages/<id>/body/0/...）可互相换算。
 */

// 类型一律从 contracts / validation 直取（type-only，构建期擦除）；
// 运行时代码只允许从 ui-studio/shared/evaluate.js 引入，避免把 Node 侧模块打进浏览器包。
import type {
  UiNode,
  UiScreenDocument,
} from "../../src/contracts/ui-document.js";
import type { UiValidationIssue } from "../../src/validation/ui-document.js";
import type { UiStudioProjectSnapshot } from "../../src/ui-studio/project.js";

/** 当前选中位置。 */
export interface Selection {
  screenId: string;
  /** 段路径；空串表示选中页面本身而非某个节点。 */
  nodePath: string;
}

/** 预览 fixture 的宽松形状（.ui-studio/preview.fixture.json）。 */
export interface PreviewFixture {
  player?: Record<string, unknown>;
  params?: Record<string, unknown>;
  data?: Record<string, unknown>;
  state?: Record<string, unknown>;
  screens?: Record<
    string,
    {
      params?: Record<string, unknown>;
      data?: Record<string, unknown>;
      state?: Record<string, unknown>;
    }
  >;
}

/** 未提供 fixture 时的内置玩家假数据。 */
export const DEFAULT_PLAYER: Record<string, unknown> = {
  id: "preview-player-0000",
  name: "预览玩家",
  level: 12,
};

export function asFixture(raw: unknown): PreviewFixture {
  if (typeof raw === "object" && raw !== null && !Array.isArray(raw)) {
    return raw as PreviewFixture;
  }
  return {};
}

/** 节点的子容器：when → content；each → template/empty。 */
export function nodeChildSlots(node: UiNode): Array<{ key: string; nodes: UiNode[] }> {
  if (node.type === "when") return [{ key: "content", nodes: node.content }];
  if (node.type === "each") {
    const slots: Array<{ key: string; nodes: UiNode[] }> = [
      { key: "template", nodes: node.template },
    ];
    if (node.empty) slots.push({ key: "empty", nodes: node.empty });
    return slots;
  }
  return [];
}

/** 按段路径取节点；path 为空串时返回 null（表示页面本身）。 */
export function nodeAtPath(screen: UiScreenDocument, path: string): UiNode | null {
  if (!path) return null;
  const segments = path.split("/");
  let nodes: UiNode[] = screen.body;
  let current: UiNode | undefined;
  for (let i = 0; i < segments.length; i += 2) {
    const index = Number(segments[i]);
    if (!Number.isInteger(index)) return null;
    current = nodes[index];
    if (!current) return null;
    const slotKey = segments[i + 1];
    if (slotKey === undefined) return current;
    const slot = nodeChildSlots(current).find((item) => item.key === slotKey);
    if (!slot) return null;
    nodes = slot.nodes;
  }
  return current ?? null;
}

/** 工程内按 file 反查页面 id；优先用校验通过的 feature，损坏时退化到原始 JSON。 */
export function screenIdByFile(
  snapshot: UiStudioProjectSnapshot,
  file: string,
): string | null {
  const fromFeature = (
    screens: Array<{ id?: unknown; file?: unknown }> | undefined,
  ): string | null => {
    const hit = (screens ?? []).find((item) => item.file === file);
    return typeof hit?.id === "string" ? hit.id : null;
  };
  if (snapshot.browse.feature) {
    return fromFeature(snapshot.browse.feature.screens);
  }
  // feature 本身未通过校验时，仍尽力从原始 JSON 建立 file→id 映射。
  const raw = snapshot.feature;
  if (typeof raw === "object" && raw !== null) {
    return fromFeature(
      (raw as { screens?: Array<{ id?: unknown; file?: unknown }> }).screens,
    );
  }
  return null;
}

/**
 * 把诊断的 JSON Pointer 解析为可选中的位置。
 * 支持 /pages/<screenId>/... 与 /files/<file>/... 两种前缀；
 * 注意 <file> 本身可能含路径分隔符（如 screens/home.ui.json），
 * 因此用工程已知的文件清单做最长前缀匹配，而不是按段切分。
 */
export function locateIssue(
  snapshot: UiStudioProjectSnapshot,
  issue: UiValidationIssue,
): Selection | null {
  const segments = issue.path.split("/").filter(Boolean);
  if (segments.length < 2) return null;
  let screenId: string | null = null;
  let rest: string[] = [];
  if (segments[0] === "pages") {
    screenId = segments[1] ?? null;
    rest = segments.slice(2);
  } else if (segments[0] === "files") {
    const tail = segments.slice(1).join("/");
    const file = Object.keys(snapshot.screens)
      .filter((name) => tail === name || tail.startsWith(`${name}/`))
      .sort((a, b) => b.length - a.length)[0];
    if (!file) return null;
    screenId = screenIdByFile(snapshot, file);
    rest = tail.slice(file.length).split("/").filter(Boolean);
  } else {
    return null;
  }
  if (!screenId) return null;
  // 只保留能映射到节点的段：body/<i> 及其后的 content/template/empty/<i>。
  const nodeSegments: string[] = [];
  if (rest[0] === "body") {
    nodeSegments.push("body");
    for (let i = 1; i < rest.length; i++) {
      const segment = rest[i] ?? "";
      if (/^\d+$/.test(segment)) {
        nodeSegments.push(segment);
        continue;
      }
      if (["content", "template", "empty"].includes(segment)) {
        nodeSegments.push(segment);
        continue;
      }
      break;
    }
  }
  return { screenId, nodePath: nodeSegments.join("/") };
}

/** 节点在树/画布中的展示名。 */
export function nodeDisplayName(node: UiNode): string {
  switch (node.type) {
    case "header":
    case "text":
      return `${node.type} · ${truncate(node.text)}`;
    case "info":
      return `info · ${node.items.length} 行`;
    case "image":
      return `image · ${node.alt ?? node.source}`;
    case "button":
      return `button · ${truncate(node.label)}`;
    case "textField":
    case "toggle":
    case "dropdown":
    case "slider":
      return `${node.type} · ${truncate(node.label)}`;
    case "when":
      return "when 条件块";
    case "each":
      return `each · ${node.as}`;
    default:
      return node.type;
  }
}

function truncate(value: string, max = 12): string {
  return value.length > max ? `${value.slice(0, max)}…` : value;
}
