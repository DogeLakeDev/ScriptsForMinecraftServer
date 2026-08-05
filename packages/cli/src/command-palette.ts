/**
 * command-palette.ts — `/` 命令补全器（类 Windows 级联菜单，仅由输入框内容驱动）
 */
import chalk from "chalk";
import { listPaletteRoots, type PaletteNode } from "./command-surface.js";
import { t } from "./i18n/index.js";
import { visibleWidth } from "./logs.js";
import { T } from "./theme.js";

const PAGE = 10;
/** 每列固定总宽（含左边条 + 正文 + 右侧 ›） */
export const PANEL_WIDTH = 28;
const PANEL_GAP = " ";
const MARKER_W = 1;
const CHEVRON_W = 1;
const INNER_WIDTH = PANEL_WIDTH - MARKER_W - CHEVRON_W;

/** 层级底色（区分多级子菜单） */
const LEVEL_BG: readonly string[] = [T.surface, T.panel, "#1a1d23", T.subtle];
const LEVEL_SEL: readonly string[] = [T.surfaceHi, "#4a5160", "#3a404c", "#5a6270"];
/** 非当前列：整体压暗一档 */
const LEVEL_BG_DIM: readonly string[] = ["#22252c", "#1a1d22", "#14161b", "#2e333c"];
const LEVEL_SEL_DIM: readonly string[] = ["#2a2e36", "#262a32", "#1e2228", "#343a44"];
const MATCH_FG = T.cyan;

export type PaletteColumn = {
  items: PaletteNode[];
  selected: number;
  scroll: number;
};

export type PaletteView = {
  columns: PaletteColumn[];
  /** 可导航列 = 最右列 */
  active: number;
  committed: string[];
  partial: string;
  trailingSpace: boolean;
  /** 自由参数输入中：不展示面板 */
  hidden: boolean;
};

export type SlashParse = {
  committed: string[];
  partial: string;
  trailingSpace: boolean;
};

/** 解析 `/` 后的输入 */
export function parseSlashLine(line: string): SlashParse {
  const body = line.startsWith("/") ? line.slice(1) : line;
  const trailingSpace = body.length > 0 && /\s$/.test(body);
  const raw = body.trim() ? body.trim().split(/\s+/) : [];
  if (trailingSpace) return { committed: raw, partial: "", trailingSpace: true };
  if (raw.length === 0) return { committed: [], partial: "", trailingSpace: false };
  return { committed: raw.slice(0, -1), partial: raw[raw.length - 1]!, trailingSpace: false };
}

function descOf(n: PaletteNode): string {
  if (!n.descKey) return "";
  try {
    return t(n.descKey as Parameters<typeof t>[0]);
  } catch {
    return "";
  }
}

export function clipPad(s: string, width: number): string {
  let out = "";
  for (const ch of s) {
    if (visibleWidth(out + ch) > width) break;
    out += ch;
  }
  while (visibleWidth(out) < width) out += " ";
  return out;
}

/** 在 text 中找 query 的首次出现（忽略大小写；label 带 / 时也试去前缀） */
export function findMatchRange(text: string, q: string): { start: number; end: number } | null {
  if (!q) return null;
  const lq = q.toLowerCase();
  const lower = text.toLowerCase();
  let i = lower.indexOf(lq);
  if (i >= 0) return { start: i, end: i + q.length };
  if (text.startsWith("/")) {
    i = lower.slice(1).indexOf(lq);
    if (i >= 0) return { start: i + 1, end: i + 1 + q.length };
  }
  return null;
}

type CellStyle = {
  bg: string;
  fg: string;
  match: string;
  desc: string;
};

function cellStyle(selected: boolean, level: number, activeCol: boolean): CellStyle {
  const i = level % LEVEL_BG.length;
  if (activeCol) {
    return {
      bg: selected ? (LEVEL_SEL[i] ?? T.surfaceHi) : (LEVEL_BG[i] ?? T.surface),
      fg: selected ? T.text : T.muted,
      match: MATCH_FG,
      desc: selected ? T.muted : T.subtle,
    };
  }
  return {
    bg: selected ? (LEVEL_SEL_DIM[i] ?? T.surface) : (LEVEL_BG_DIM[i] ?? T.panel),
    fg: selected ? T.muted : T.subtle,
    match: T.subtle,
    desc: T.subtle,
  };
}

function paintSeg(bg: string, fg: string, text: string): string {
  if (!text) return "";
  return chalk.bgHex(bg).hex(fg)(text);
}

/** 按可见宽度截断并着色一段纯文本 */
function paintClipped(bg: string, fg: string, text: string, maxW: number): { painted: string; used: number } {
  let plain = "";
  let painted = "";
  for (const ch of text) {
    if (visibleWidth(plain + ch) > maxW) break;
    plain += ch;
    painted += paintSeg(bg, fg, ch);
  }
  return { painted, used: visibleWidth(plain) };
}

/** 正文区：label（可高亮匹配）+ 描述；总可见宽 INNER_WIDTH */
function paintInner(n: PaletteNode, query: string, style: CellStyle): string {
  const label = n.label;
  const desc = descOf(n);
  const range = findMatchRange(label, query);
  let out = "";
  let used = 0;

  for (let i = 0; i < label.length; i++) {
    const ch = label[i]!;
    const cw = visibleWidth(ch);
    if (used + cw > INNER_WIDTH) break;
    const inMatch = range !== null && i >= range.start && i < range.end;
    out += paintSeg(style.bg, inMatch ? style.match : style.fg, ch);
    used += cw;
  }

  if (desc && used + 1 < INNER_WIDTH) {
    out += paintSeg(style.bg, style.desc, " ");
    used += 1;
    const room = INNER_WIDTH - used;
    const d = paintClipped(style.bg, style.desc, desc, room);
    out += d.painted;
    used += d.used;
  }

  if (used < INNER_WIDTH) {
    out += paintSeg(style.bg, style.fg, " ".repeat(INNER_WIDTH - used));
  }
  return out;
}

function paintCell(
  n: PaletteNode,
  selected: boolean,
  level: number,
  activeCol: boolean,
  query: string
): string {
  const style = cellStyle(selected, level, activeCol);
  const marker = selected ? "▌" : " ";
  const hasKids = Boolean(n.children?.length);
  const chevron = hasKids ? "›" : " ";
  const q = activeCol ? query : "";
  return (
    paintSeg(style.bg, selected && activeCol ? MATCH_FG : style.fg, marker) +
    paintInner(n, q, style) +
    paintSeg(style.bg, style.fg, chevron)
  );
}

function blankCell(level: number, activeCol: boolean): string {
  const style = cellStyle(false, level, activeCol);
  return chalk.bgHex(style.bg)(" ".repeat(PANEL_WIDTH));
}

/** 匹配权重：越大越靠前；无查询时保持原序（同分） */
export function matchWeight(n: PaletteNode, q: string): number {
  if (!q) return 0;
  const lq = q.toLowerCase();
  const token = n.token.toLowerCase();
  const label = n.label.toLowerCase();
  const desc = descOf(n).toLowerCase();
  if (token === lq || label === `/${lq}` || label === lq) return 100;
  /* 前缀匹配：覆盖比例越高越靠前（st → start > status） */
  if (token.startsWith(lq)) return 80 + Math.round((lq.length / Math.max(token.length, 1)) * 15);
  if (label.startsWith(lq) || label.startsWith(`/${lq}`)) {
    const base = label.startsWith("/") ? label.slice(1) : label;
    return 70 + Math.round((lq.length / Math.max(base.length, 1)) * 15);
  }
  if (token.includes(lq)) return 50;
  if (label.includes(lq)) return 40;
  if (desc.includes(lq)) return 20;
  return 0;
}

/** 按权重稳定排序：匹配项置顶，不删除任何项 */
export function rankItems(items: readonly PaletteNode[], q: string): PaletteNode[] {
  if (!q) return [...items];
  return items
    .map((n, i) => ({ n, i, w: matchWeight(n, q) }))
    .sort((a, b) => b.w - a.w || a.i - b.i)
    .map((x) => x.n);
}

export function clampPaletteSelection(selected: number, len: number): number {
  if (len <= 0) return 0;
  if (selected < 0) return 0;
  if (selected >= len) return len - 1;
  return selected;
}

export function ensurePaletteScroll(selected: number, scroll: number, len: number): number {
  let s = scroll;
  if (len <= 0) return 0;
  if (selected < s) s = selected;
  if (selected >= s + PAGE) s = selected - PAGE + 1;
  const maxScroll = Math.max(0, len - PAGE);
  if (s > maxScroll) s = maxScroll;
  if (s < 0) s = 0;
  return s;
}

function pageSlice(
  items: PaletteNode[],
  selected: number,
  scroll: number
): { rows: { node: PaletteNode; index: number }[]; above: number; below: number } {
  const sel = clampPaletteSelection(selected, items.length);
  const sc = ensurePaletteScroll(sel, scroll, items.length);
  const end = Math.min(items.length, sc + PAGE);
  const rows: { node: PaletteNode; index: number }[] = [];
  for (let i = sc; i < end; i++) rows.push({ node: items[i]!, index: i });
  return { rows, above: sc, below: items.length - end };
}

function findRoot(token: string): PaletteNode | undefined {
  return listPaletteRoots("repl").find((n) => n.token === token);
}

function findChild(parent: PaletteNode | undefined, token: string): PaletteNode | undefined {
  return parent?.children?.find((n) => n.token === token);
}

/**
 * 是否已进入自由参数尾部（如 /send bds …）。
 * 路径落在 freeArgs 叶上，或叶之后还有无法匹配的多余 token，均视为自由输入。
 */
function inFreeArgTail(committed: string[]): boolean {
  let node: PaletteNode | undefined;
  for (let i = 0; i < committed.length; i++) {
    const next = i === 0 ? findRoot(committed[i]!) : findChild(node, committed[i]!);
    if (!next) {
      return Boolean(node?.freeArgs && !node.children?.length);
    }
    node = next;
  }
  return Boolean(node?.freeArgs && !node.children?.length);
}

/**
 * 命令路径是否已到末尾（无更多固定子参可选）→ 应关闭面板。
 * 末尾 = 精确匹配到无 children 的节点，或已进入 freeArgs 正文。
 */
export function isCommandAtEnd(committed: string[], partial: string, trailingSpace: boolean): boolean {
  if (inFreeArgTail(committed)) return true;

  const path = trailingSpace ? committed : partial ? [...committed, partial] : committed;
  if (path.length === 0) return false;

  let node: PaletteNode | undefined;
  for (let i = 0; i < path.length; i++) {
    const next = i === 0 ? findRoot(path[i]!) : findChild(node, path[i]!);
    if (!next) return false;
    node = next;
  }
  if (!node || (node.children?.length ?? 0) > 0) return false;
  /* 最后一段必须与节点 token 完全一致（半词前缀不算到末尾） */
  return path[path.length - 1] === node.token;
}

/**
 * 仅由输入行推导列；列内始终保留全量项，partial 只调整排序权重。
 * 子列出现条件：已提交上一参数（将要输入下一参数）。
 */
export function resolvePaletteView(line: string, sels: number[], scrolls: number[]): PaletteView {
  const { committed, partial, trailingSpace } = parseSlashLine(line);
  const roots = listPaletteRoots("repl");

  /* 命令已到末尾 → 立即关闭面板 */
  if (isCommandAtEnd(committed, partial, trailingSpace)) {
    return { columns: [], active: 0, committed, partial, trailingSpace, hidden: true };
  }

  const columns: PaletteColumn[] = [];
  const onRoot = committed.length === 0;
  /* 主列：始终全量；仅在编辑首参时按 partial 提权 */
  const mainQuery = onRoot ? partial : "";
  const mainItems = rankItems(roots, mainQuery);
  let mainSel = clampPaletteSelection(sels[0] ?? 0, mainItems.length);
  if (!onRoot) {
    const idx = mainItems.findIndex((n) => n.token === committed[0]);
    if (idx >= 0) mainSel = idx;
  } else if (partial) {
    /* 有半词时默认落在权重最高项（列表头） */
    mainSel = clampPaletteSelection(sels[0] ?? 0, mainItems.length);
  }
  columns.push({
    items: mainItems,
    selected: mainSel,
    scroll: ensurePaletteScroll(mainSel, scrolls[0] ?? 0, mainItems.length),
  });

  let parent: PaletteNode | undefined = onRoot ? undefined : findRoot(committed[0]!);
  for (let d = 1; parent?.children?.length && committed.length >= d; d++) {
    const pathTok = committed[d];
    const q = committed.length > d ? "" : trailingSpace ? "" : partial;
    const childItems = rankItems(parent.children, q);

    let sel = clampPaletteSelection(sels[d] ?? 0, childItems.length);
    if (pathTok) {
      const idx = childItems.findIndex((n) => n.token === pathTok);
      if (idx >= 0) sel = idx;
    }

    columns.push({
      items: childItems,
      selected: sel,
      scroll: ensurePaletteScroll(sel, scrolls[d] ?? 0, childItems.length),
    });

    parent = pathTok && committed.length > d ? findChild(parent, pathTok) : childItems[sel];

    if (committed.length === d && !trailingSpace) break;
    if (!parent?.children?.length) break;
  }

  return {
    columns,
    active: Math.max(0, columns.length - 1),
    committed,
    partial,
    trailingSpace,
    hidden: false,
  };
}

function formatColumnLines(col: PaletteColumn, level: number, activeCol: boolean, query: string): string[] {
  const lines: string[] = [];
  const style = cellStyle(false, level, activeCol);
  if (col.items.length === 0) {
    lines.push(
      paintSeg(style.bg, style.fg, " ") +
        paintSeg(style.bg, style.fg, clipPad(t("repl.palette.empty"), INNER_WIDTH)) +
        paintSeg(style.bg, style.fg, " ")
    );
    return lines;
  }
  const { rows, above, below } = pageSlice(col.items, col.selected, col.scroll);
  if (above > 0) {
    lines.push(
      paintSeg(style.bg, style.fg, " ") +
        paintSeg(style.bg, style.fg, clipPad(`↑${above}…`, INNER_WIDTH)) +
        paintSeg(style.bg, style.fg, " ")
    );
  }
  for (const { node, index } of rows) {
    lines.push(paintCell(node, index === col.selected, level, activeCol, query));
  }
  if (below > 0) {
    lines.push(
      paintSeg(style.bg, style.fg, " ") +
        paintSeg(style.bg, style.fg, clipPad(`↓${below}…`, INNER_WIDTH)) +
        paintSeg(style.bg, style.fg, " ")
    );
  }
  return lines;
}

export function formatPaletteCascadeLines(view: PaletteView, indentCols: number): string[] {
  if (view.hidden || view.columns.length === 0) return [];
  const indent = " ".repeat(Math.max(0, indentCols));
  const colLines = view.columns.map((col, i) =>
    formatColumnLines(col, i, i === view.active, i === view.active ? view.partial : "")
  );
  const height = Math.max(1, ...colLines.map((l) => l.length));
  const out: string[] = [];
  for (let r = 0; r < height; r++) {
    const parts: string[] = [];
    for (let cidx = 0; cidx < view.columns.length; cidx++) {
      const activeCol = cidx === view.active;
      const cell = colLines[cidx]![r] ?? blankCell(cidx, activeCol);
      const plainW = visibleWidth(cell);
      parts.push(plainW < PANEL_WIDTH ? cell + " ".repeat(PANEL_WIDTH - plainW) : cell);
    }
    out.push(indent + parts.join(PANEL_GAP));
  }
  return out;
}

export function activeNode(view: PaletteView): PaletteNode | undefined {
  if (view.hidden) return undefined;
  const col = view.columns[view.active];
  if (!col || col.items.length === 0) return undefined;
  return col.items[clampPaletteSelection(col.selected, col.items.length)];
}

/** 灰字：选中项相对当前半词的后缀 */
export function paletteGhost(view: PaletteView): string {
  const node = activeNode(view);
  if (!node || view.hidden) return "";
  /* 路径已写过本层 → 无灰字 */
  if (view.committed.length > view.active) return "";
  const p = view.partial;
  const tok = node.token;
  if (!p) return tok;
  if (tok.toLowerCase().startsWith(p.toLowerCase())) return tok.slice(p.length);
  return "";
}

/**
 * 回车写入选中项；有子参或自由参则补尾空格。
 * 若行已是该叶节点完整内容 → submit。
 */
export function commitSelection(line: string, view: PaletteView): { line: string; submit: boolean } {
  if (view.hidden || view.columns.length === 0) {
    return { line, submit: true };
  }
  const node = activeNode(view);
  if (!node) return { line, submit: true };

  const { committed, partial, trailingSpace, active } = view;

  /* 叶节点且输入已完整匹配 → 提交执行 */
  const isLeaf = !node.children?.length && !node.freeArgs;
  if (isLeaf && !trailingSpace) {
    if (committed.length === active && partial === node.token) {
      return { line: "/" + [...committed, node.token].join(" "), submit: true };
    }
    if (committed.length === active + 1 && committed[active] === node.token && !partial) {
      return { line, submit: true };
    }
  }

  const tokens = committed.slice(0, active);
  tokens.push(node.token);
  let next = "/" + tokens.join(" ");
  if (node.children?.length || node.freeArgs) next += " ";
  return { line: next, submit: false };
}

export function promptSlashColumn(prompt: string): number {
  return visibleWidth(prompt);
}
