import { nodeTypeIcon, type NodeIcon } from "./node-icons";
import { DragHandle } from "./DragHandle";

/** 组件库拖拽的 dataTransfer 类型；画布内移动另用 MOVE_MIME。 */
export const PALETTE_MIME = "application/x-sfmc-palette";
export const MOVE_MIME = "application/x-sfmc-move";

interface PaletteItem {
  type: string;
  label: string;
  /** 新节点的默认字段（id 由画布侧按文档去重后填入）。 */
  defaults: Record<string, unknown>;
}

const PALETTE_ITEMS: PaletteItem[] = [
  { type: "header", label: "标题", defaults: { text: "标题" } },
  { type: "text", label: "文本", defaults: { text: "文本内容" } },
  { type: "info", label: "信息", defaults: { items: ["说明文字"] } },
  { type: "image", label: "图片", defaults: { source: "textures/items/diamond", pack: "sfmc", alt: "图片" } },
  { type: "divider", label: "分隔线", defaults: {} },
  { type: "spacer", label: "占位", defaults: { size: "medium" } },
  { type: "button", label: "按钮", defaults: { label: "按钮", trigger: { type: "refresh" } } },
  { type: "textField", label: "输入框", defaults: { label: "输入框", bind: "state.input", placeholder: "请输入…" } },
  { type: "toggle", label: "开关", defaults: { label: "开关", bind: "state.enabled" } },
  { type: "dropdown", label: "下拉", defaults: { label: "下拉", bind: "state.choice", options: [{ value: "a", label: "选项 A" }, { value: "b", label: "选项 B" }] } },
  { type: "slider", label: "滑杆", defaults: { label: "滑杆", bind: "state.level", min: 0, max: 100 } },
  // when 默认用常量条件：引用未声明的 state 会让页面立即失验而从画布消失。
  { type: "when", label: "条件", defaults: { condition: { value: true }, content: [] } },
  { type: "each", label: "循环", defaults: { source: "data.items", as: "item", template: [], empty: [] } },
];

/** 依据组件库条目构造新节点（id 已去重）。 */
export function createPaletteNode(type: string, id: string): Record<string, unknown> | null {
  const item = PALETTE_ITEMS.find((entry) => entry.type === type);
  if (!item) return null;
  return { id, type: item.type, ...structuredClone(item.defaults) };
}

export function Palette() {
  return (
    <div className="palette">
      <div className="tree-heading">组件库</div>
      <div className="palette-grid">
        {PALETTE_ITEMS.map((item) => {
          const Icon: NodeIcon = nodeTypeIcon(item.type);
          return (
            <div key={item.type} className="palette-item" data-drag-ghost>
              <DragHandle
                label="拖到画布插入"
                onDragStart={(event) => {
                  event.dataTransfer.setData(PALETTE_MIME, item.type);
                  event.dataTransfer.effectAllowed = "copy";
                }}
              />
              <Icon size={14} strokeWidth={1.8} />
              <span>{item.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
