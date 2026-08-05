import { useEffect, useMemo, useState } from "react";
import type { StimulusKind } from "./StimulusNode";

export type PaletteItem = { kind: StimulusKind; title: string; group: string; keywords: string[]; enabled?: boolean };

export const NODE_PALETTE_ITEMS: PaletteItem[] = [
  { kind: "player", title: "新建 Player", group: "造物", keywords: ["player", "玩家", "玩家名", "在线", "spawn", "create"] },
  { kind: "entity", title: "新建 Entity", group: "造物", keywords: ["entity", "实体", "mob", "生物", "spawn", "create"] },
  { kind: "item", title: "新建 ItemStack", group: "造物", keywords: ["item", "itemstack", "物品", "堆叠", "道具", "create"] },
  { kind: "scoreboard", title: "新建 Scoreboard", group: "造物", keywords: ["scoreboard", "计分板", "分数", "objective", "score", "create"] },
  { kind: "emit", title: "Emit", group: "刺激", keywords: ["emit", "trigger", "触发", "事件", "event", "发送"] },
  { kind: "call", title: "Call", group: "刺激", keywords: ["call", "invoke", "调用", "方法", "method", "执行"] },
  { kind: "tick", title: "Tick", group: "刺激", keywords: ["tick", "时间", "等待", "推进", "帧", "step"] },
  { kind: "assert", title: "断言 · 日志包含", group: "断言", keywords: ["assert log", "断言", "日志", "pattern", "匹配", "包含", "log"] },
  { kind: "assert", title: "断言 · 属性", group: "断言", keywords: ["assert prop", "断言", "属性", "property", "字段", "equals"] },
  { kind: "assert", title: "断言 · 数量", group: "断言", keywords: ["assert count", "断言", "数量", "count", "个数", "统计"] },
  { kind: "assert", title: "断言 · 场景存在", group: "断言", keywords: ["scene exists", "断言", "场景", "存在", "exists", "对象"] },
  { kind: "assert", title: "断言 · Last Emit", group: "断言", keywords: ["last emit", "断言", "上次事件", "emit", "结果"] },
  { kind: "assert", title: "断言 · Last Call", group: "断言", keywords: ["last call", "断言", "上次调用", "call", "返回值"] },
  { kind: "branch", title: "Branch", group: "控制", keywords: ["branch", "分支", "条件", "if", "判断", "pass", "fail"] },
  { kind: "repeat", title: "Repeat", group: "控制", keywords: ["repeat", "循环", "重复", "loop", "次数", "迭代"] },
  { kind: "frame", title: "Frame", group: "分组", keywords: ["frame", "框架", "分组", "容器", "group", "背景"] },
  { kind: "viewer", title: "Viewer", group: "预览", keywords: ["viewer", "预览", "查看", "inspect", "属性", "spreadsheet", "表格"] },
];

function subsequence(query: string, text: string): boolean {
  let i = 0;
  for (const ch of text) if (ch === query[i]) i++;
  return i === query.length;
}

export function scorePaletteItem(item: PaletteItem, query: string): number {
  const terms = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  if (!terms.length) return 1;
  const fields = [item.title, item.group, ...item.keywords].map((x) => x.toLowerCase());
  let score = 0;
  for (const term of terms) {
    const hits = fields.filter((field) => field.includes(term)).length;
    const prefix = fields.some((field) => field.startsWith(term)) ? 4 : 0;
    const fuzzy = fields.some((field) => subsequence(term, field)) ? 2 : 0;
    if (!hits && !fuzzy) return 0;
    score += hits + prefix + fuzzy;
  }
  return score;
}

export function NodePalette({ open, onClose, onCreate }: { open: boolean; onClose: () => void; onCreate: (kind: StimulusKind) => void }) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const items = useMemo(() => NODE_PALETTE_ITEMS.map((item) => ({ item, score: scorePaletteItem(item, query) })).filter((x) => x.score > 0).sort((a, b) => b.score - a.score), [query]);
  useEffect(() => { if (open) { setQuery(""); setActive(0); } }, [open]);
  if (!open) return null;
  const choose = (item: PaletteItem) => { onCreate(item.kind); onClose(); };
  return <div className="palette-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
    <div className="node-palette" role="dialog" aria-modal="true" aria-label="添加节点">
      <div className="palette-title">添加节点</div>
      <input autoFocus value={query} placeholder="搜索节点、用途或关键词" onChange={(e) => { setQuery(e.target.value); setActive(0); }} onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
        else if (e.key === "ArrowDown") { e.preventDefault(); setActive((x) => Math.min(items.length - 1, x + 1)); }
        else if (e.key === "ArrowUp") { e.preventDefault(); setActive((x) => Math.max(0, x - 1)); }
        else if (e.key === "Enter" && items[active]) choose(items[active].item);
      }} />
      <div className="palette-list">{items.map(({ item }, index) => <button key={`${item.group}-${item.title}`} className={index === active ? "active" : ""} onMouseEnter={() => setActive(index)} onClick={() => choose(item)}><span>{item.title}</span><small>{item.group}</small></button>)}</div>
    </div>
  </div>;
}
