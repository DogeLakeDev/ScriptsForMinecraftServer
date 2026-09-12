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
import type { UiStudioBrowseView } from "../../src/ui-studio/project.js";

/**
 * 当前选中位置：
 * - screen：某个页面（nodePath 为空串表示页面本身，否则为 body/... 段路径）；
 * - feature：feature.ui.json；
 * - file：其他文件（如预览 fixture）。
 */
export type Selection =
  | { kind: "screen"; screenId: string; nodePath: string }
  | { kind: "feature" }
  | { kind: "file"; file: string };

/** feature 文件在文件表中的固定键（即其相对路径）。 */
export const FEATURE_FILE = "feature.ui.json";

/**
 * 工程视图：组件树/画布/诊断/属性面板统一的数据来源。
 * 由浏览器内文件表实时派生（deriveView），与服务端同一套校验器。
 */
export interface ProjectView {
  /** feature.ui.json 原始内容（保留未知字段）。 */
  feature: unknown;
  /** 全部文件原始内容，键为相对路径（含 feature 与其他文件）。 */
  files: Record<string, unknown>;
  /** 逐文件独立校验后的可浏览视图。 */
  browse: UiStudioBrowseView;
  /** 统一诊断（结构与跨文件语义）。 */
  issues: UiValidationIssue[];
  /** 项目内维护的 service 名称（由导入的 manifest 提取）。 */
  services: string[];
}

/** 按页面 id 反查其文件相对路径；feature 损坏时退化到扫描页面文档的 id 字段。 */
export function fileByScreenId(view: ProjectView, screenId: string): string | null {
  const feature = view.feature;
  if (typeof feature === "object" && feature !== null) {
    const screens = (feature as { screens?: unknown }).screens;
    if (Array.isArray(screens)) {
      const hit = screens.find(
        (item) =>
          typeof item === "object" &&
          item !== null &&
          (item as { id?: unknown }).id === screenId &&
          typeof (item as { file?: unknown }).file === "string",
      );
      if (hit) return (hit as { file: string }).file;
    }
  }
  for (const [file, doc] of Object.entries(view.files)) {
    if (
      typeof doc === "object" &&
      doc !== null &&
      (doc as { id?: unknown }).id === screenId
    ) {
      return file;
    }
  }
  return null;
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

/** 绑定选择器的一组候选路径。 */
export interface BindGroup {
  label: string;
  options: Array<{ value: string; hint?: string }>;
}

/**
 * 汇总绑定选择器的候选路径：
 * 状态/参数/数据源/计算值来自页面声明，玩家来自预览 fixture（对象值再展开一层）。
 * 注意：输入组件的 bind 契约要求 state.*，由调用方按字段过滤分组。
 */
export function collectBindPaths(doc: unknown, fixture: PreviewFixture): BindGroup[] {
  const groups: BindGroup[] = [];
  const record = (typeof doc === "object" && doc !== null ? doc : {}) as Record<string, unknown>;
  const keysOf = (value: unknown): string[] =>
    typeof value === "object" && value !== null && !Array.isArray(value)
      ? Object.keys(value as Record<string, unknown>)
      : [];
  const push = (label: string, root: string, keys: string[], hints?: Record<string, string>) => {
    if (keys.length === 0) return;
    groups.push({
      label,
      options: keys.map((key) => ({ value: `${root}.${key}`, hint: hints?.[key] })),
    });
  };

  // 状态：hint 展示声明的值的类型。
  const stateKeys = keysOf(record.state);
  const stateHints: Record<string, string> = {};
  for (const key of stateKeys) {
    const decl = (record.state as Record<string, unknown>)[key];
    const type =
      typeof decl === "object" && decl !== null
        ? (decl as { type?: unknown }).type
        : undefined;
    if (typeof type === "string") stateHints[key] = type;
  }
  push("状态 state", "state", stateKeys, stateHints);
  push("参数 params", "params", keysOf(record.params));
  push("数据源 data", "data", keysOf(record.load));
  push("计算值 derived", "derived", keysOf(record.derived));

  // 玩家：fixture.player 的键；对象值展开一层（如 player.location.x）。
  const player = fixture.player ?? {};
  const playerOptions: Array<{ value: string; hint?: string }> = [];
  for (const key of Object.keys(player)) {
    playerOptions.push({ value: `player.${key}` });
    const value = player[key];
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      for (const sub of Object.keys(value as Record<string, unknown>)) {
        playerOptions.push({ value: `player.${key}.${sub}` });
      }
    }
  }
  if (playerOptions.length > 0) groups.push({ label: "玩家 player", options: playerOptions });

  return groups;
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
  // 段路径以 body 开头（body/2/content/1），先越过该前缀。
  if (segments[0] === "body") segments.shift();
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
export function screenIdByFile(view: ProjectView, file: string): string | null {
  const fromFeature = (
    screens: Array<{ id?: unknown; file?: unknown }> | undefined,
  ): string | null => {
    const hit = (screens ?? []).find((item) => item.file === file);
    return typeof hit?.id === "string" ? hit.id : null;
  };
  if (view.browse.feature) {
    return fromFeature(view.browse.feature.screens);
  }
  // feature 本身未通过校验时，仍尽力从原始 JSON 建立 file→id 映射。
  if (typeof view.feature === "object" && view.feature !== null) {
    return fromFeature(
      (view.feature as { screens?: Array<{ id?: unknown; file?: unknown }> }).screens,
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
  view: ProjectView,
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
    const file = Object.keys(view.files)
      .filter((name) => tail === name || tail.startsWith(`${name}/`))
      .sort((a, b) => b.length - a.length)[0];
    if (!file) return null;
    screenId = screenIdByFile(view, file);
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
  return { kind: "screen", screenId, nodePath: nodeSegments.join("/") };
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

/**
 * 插入地址：目标容器（containerPath 为容器节点段路径，空串表示页面 body）
 * + 槽位（body/content/template/empty）+ 下标。
 */
export interface InsertAddress {
  containerPath: string;
  slotKey: string;
  index: number;
}

/** 把节点段路径解析为其所在的插入地址（自身下标）。 */
export function parseNodeLocation(path: string): InsertAddress | null {
  if (!path) return null;
  const segments = path.split("/");
  const index = Number(segments.pop());
  const slotKey = segments.pop();
  if (!Number.isInteger(index) || !slotKey) return null;
  if (!["body", "content", "template", "empty"].includes(slotKey)) return null;
  return { containerPath: segments.join("/"), slotKey, index };
}

/** 由插入地址反推目标位置的段路径。 */
export function pathOfAddress(addr: InsertAddress): string {
  return addr.slotKey === "body"
    ? `body/${addr.index}`
    : `${addr.containerPath}/${addr.slotKey}/${addr.index}`;
}

/** 在原始文档上解析目标容器数组；失败返回 null。直接引用，勿跨文档混用。 */
function resolveContainer(
  doc: unknown,
  containerPath: string,
  slotKey: string,
): unknown[] | null {
  if (slotKey === "body") {
    const body = (doc as { body?: unknown }).body;
    return Array.isArray(body) ? body : null;
  }
  const parent = nodeAtPath(doc as UiScreenDocument, containerPath);
  if (!parent) return null;
  const slot = (parent as unknown as Record<string, unknown>)[slotKey];
  return Array.isArray(slot) ? (slot as unknown[]) : null;
}

/**
 * 在原始文档的指定地址插入节点（原地修改，调用方先 structuredClone）。
 * 返回新节点的段路径；失败返回 null。
 */
export function insertNode(
  doc: unknown,
  addr: InsertAddress,
  node: Record<string, unknown>,
): string | null {
  const container = resolveContainer(doc, addr.containerPath, addr.slotKey);
  if (!container) return null;
  const index = Math.max(0, Math.min(addr.index, container.length));
  container.splice(index, 0, node);
  return pathOfAddress({ ...addr, index });
}

/** 按段路径移除节点（原地修改），返回被移除的节点；失败返回 null。 */
export function removeNodeAt(doc: unknown, path: string): Record<string, unknown> | null {
  const location = parseNodeLocation(path);
  if (!location) return null;
  const container = resolveContainer(doc, location.containerPath, location.slotKey);
  if (!container || location.index >= container.length) return null;
  const [removed] = container.splice(location.index, 1);
  return (removed as Record<string, unknown>) ?? null;
}

/**
 * 移动节点到新地址（原地修改）。禁止移入自身内部；
 * 同容器后移时自动修正先删后插的下标偏移。返回新段路径；失败返回 null。
 */
export function moveNode(doc: unknown, fromPath: string, addr: InsertAddress): string | null {
  // 目标容器不能是被移动节点自身或其子孙。
  if (addr.containerPath === fromPath || addr.containerPath.startsWith(`${fromPath}/`)) {
    return null;
  }
  const from = parseNodeLocation(fromPath);
  if (!from) return null;
  const removed = removeNodeAt(doc, fromPath);
  if (!removed) return null;
  let index = addr.index;
  if (
    from.containerPath === addr.containerPath &&
    from.slotKey === addr.slotKey &&
    from.index < addr.index
  ) {
    index -= 1;
  }
  return insertNode(doc, { ...addr, index }, removed);
}

/**
 * 拖入新节点后补齐其引用的声明，避免页面因「未声明引用」立即失验：
 * - 输入组件的 state.<key>：按节点类型补 string/boolean/number 声明；
 * - each 的 data.<key>：补 load 条目（service 取项目第一个，无则占位 example.service，
 *   会在诊断区留下「未知 service」提示，引导用户配置真实数据源）。
 * 原地修改（调用方先 structuredClone）；已存在的声明不覆盖。
 */
export function ensureDeclarations(
  doc: unknown,
  node: Record<string, unknown>,
  services: string[],
): void {
  if (typeof doc !== "object" || doc === null) return;
  const record = doc as Record<string, unknown>;
  const bindPath = typeof node.bind === "string" ? node.bind : null;
  if (bindPath?.startsWith("state.")) {
    const key = bindPath.slice("state.".length);
    const state = (record.state ??= {}) as Record<string, unknown>;
    if (!(key in state)) {
      const type =
        node.type === "toggle" ? "boolean" : node.type === "slider" ? "number" : "string";
      const decl: Record<string, unknown> = { type };
      if (node.type === "slider") {
        if (typeof node.min === "number") decl.min = node.min;
        if (typeof node.max === "number") decl.max = node.max;
      }
      state[key] = decl;
    }
  }
  const source = typeof node.source === "string" ? node.source : null;
  if (node.type === "each" && source?.startsWith("data.")) {
    const key = source.slice("data.".length);
    const load = (record.load ??= {}) as Record<string, unknown>;
    if (!(key in load)) {
      load[key] = { service: services[0] ?? "example.service" };
    }
  }
}

/** 生成文档内唯一的节点 id：base 可用则用 base，否则 base-2 / -3 …。 */
export function uniqueNodeId(doc: unknown, base: string): string {
  const ids = new Set<string>();
  const walk = (nodes: unknown): void => {
    if (!Array.isArray(nodes)) return;
    for (const item of nodes) {
      if (typeof item !== "object" || item === null) continue;
      const record = item as Record<string, unknown>;
      if (typeof record.id === "string") ids.add(record.id);
      walk(record.content);
      walk(record.template);
      walk(record.empty);
    }
  };
  walk((doc as { body?: unknown }).body);
  if (!ids.has(base)) return base;
  for (let n = 2; ; n += 1) {
    const candidate = `${base}-${n}`;
    if (!ids.has(candidate)) return candidate;
  }
}

/**
 * 在原始（未校验）页面文档上按段路径定位节点并执行修改。
 * 直接 mutate 传入的 doc——调用方负责先 structuredClone。
 * 返回是否定位成功；失败时不做任何修改。
 */
export function mutateNodeAtPath(
  doc: unknown,
  nodePath: string,
  mutate: (node: Record<string, unknown>) => void,
): boolean {
  if (!nodePath || typeof doc !== "object" || doc === null) return false;
  const segments = nodePath.split("/");
  // 首段固定为 body。
  if (segments[0] !== "body") return false;
  let nodes = (doc as { body?: unknown }).body;
  if (!Array.isArray(nodes)) return false;
  let current: unknown;
  for (let i = 1; i < segments.length; i += 2) {
    const index = Number(segments[i]);
    if (!Number.isInteger(index) || !Array.isArray(nodes)) return false;
    current = nodes[index];
    if (typeof current !== "object" || current === null) return false;
    const slotKey = segments[i + 1];
    if (slotKey === undefined) break;
    if (!["content", "template", "empty"].includes(slotKey)) return false;
    nodes = (current as Record<string, unknown>)[slotKey];
  }
  if (typeof current !== "object" || current === null) return false;
  mutate(current as Record<string, unknown>);
  return true;
}
