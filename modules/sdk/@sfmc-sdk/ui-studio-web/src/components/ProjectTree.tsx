/**
 * ProjectTree.tsx — 左栏：工程 / 页面 / 组件树与文件操作。
 *
 * 三个分区：
 * - Feature：feature.ui.json（点击编辑模块级声明）；
 * - 页面：feature 声明的页面文件，可展开组件树；
 *   支持新建 / 重命名 / 复制 / 删除（自动同步 feature.screens 引用）；
 * - 其他文件：未登记为页面的 JSON 文件（如预览 fixture），可查看/删除。
 */

import type { UiNode } from "../../../src/contracts/ui-document.js";
import {
  AppWindow,
  ChevronDown,
  ChevronRight,
  Copy,
  Eye,
  FileJson2,
  FlaskConical,
  LogIn,
  Package,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { nodeTypeIcon } from "./node-icons";
import {
  FEATURE_FILE,
  nodeChildSlots,
  nodeDisplayParts,
  type ProjectView,
  type Selection,
} from "../model";
import { FIXTURE_DIR, FIXTURE_FILE, screenRefs } from "../store/project";
import { fixtureLabel } from "./FixtureSwitcher";
import { ContextMenu, useContextMenu } from "./ContextMenu";

interface ProjectTreeProps {
  view: ProjectView;
  selection: Selection | null;
  /** 场景 fixture 文件清单（不含基础场景）。 */
  fixtureScenarios: string[];
  /** 当前画布使用的 fixture 文件。 */
  activeFixture: string;
  onSelect(selection: Selection): void;
  onAddScreen(): void;
  onRenameScreen(file: string): void;
  onDuplicateScreen(file: string): void;
  onRemoveScreen(file: string): void;
  onRemoveFile(file: string): void;
  onAddFixture(): void;
  onRenameFixture(file: string): void;
}

export function ProjectTree({
  view,
  selection,
  fixtureScenarios,
  activeFixture,
  onSelect,
  onAddScreen,
  onRenameScreen,
  onDuplicateScreen,
  onRemoveScreen,
  onRemoveFile,
  onAddFixture,
  onRenameFixture,
}: ProjectTreeProps) {
  const feature = view.browse.feature;
  const screens = view.browse.screens;
  const declared = new Set(screenRefs(view.files).map((ref) => ref.file));
  // fixture（基础 + 场景）有独立分区，不再混入「其他文件」。
  const otherFiles = Object.keys(view.files)
    .filter(
      (file) =>
        file !== FEATURE_FILE &&
        file !== FIXTURE_FILE &&
        !file.startsWith(`${FIXTURE_DIR}/`) &&
        !declared.has(file),
    )
    .sort();
  // 右键菜单状态：页面行与其他文件行共用。
  const { menu, open: openMenu, close: closeMenu } = useContextMenu();
  // 组件树折叠状态：key 为 `${screenId}:${nodePath}`，默认全部展开。
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
  const toggleNode = (key: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  // 从画布选中嵌套节点时，自动展开其祖先，避免折叠后找不到当前项。
  useEffect(() => {
    if (selection?.kind !== "screen" || !selection.nodePath) return;
    const keys = ancestorNodePaths(selection.nodePath).map(
      (path) => `${selection.screenId}:${path}`,
    );
    setCollapsed((prev) => {
      let changed = false;
      const next = new Set(prev);
      for (const key of keys) {
        if (next.delete(key)) changed = true;
      }
      return changed ? next : prev;
    });
  }, [selection]);

  return (
    <div className="tree">
      <div className="tree-section">
        <div className="tree-heading">Feature</div>
        <button
          className={`tree-screen${selection?.kind === "feature" ? " active" : ""}`}
          onClick={() => onSelect({ kind: "feature" })}
          title={FEATURE_FILE}
        >
          <Package size={13} className="tree-icon" />
          {feature?.name ?? feature?.moduleId ?? "feature.ui.json"}
        </button>
        {feature ? (
          <ul className="tree-entries">
            {feature.entries.map((entry) => {
              const exists = Boolean(view.browse.screens[entry.target]);
              return (
                <li key={entry.id} title={`${entry.surface} / ${entry.group}`}>
                  <button
                    className="tree-entry"
                    disabled={!exists}
                    onClick={() =>
                      onSelect({ kind: "screen", screenId: entry.target, nodePath: "" })
                    }
                  >
                    <LogIn size={13} className="tree-icon" />
                    <span className="tree-node-text">
                      {entry.title}
                      <span className="tree-dim tree-entry-target">{entry.target}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="tree-empty">feature.ui.json 未通过校验，点击上方条目修复</div>
        )}
      </div>

      <div className="tree-section">
        <div className="tree-heading tree-heading-row">
          页面
          <button className="tree-action" onClick={onAddScreen} title="新建页面">
            <Plus size={13} />
          </button>
        </div>
        <ul className="tree-screens">
          {screenRefs(view.files).map((reference) => {
            const screen = screens[reference.id];
            const active =
              selection?.kind === "screen" && selection.screenId === reference.id;
            return (
              <li key={reference.id}>
                <div
                  className={`tree-screen-row${active ? " active" : ""}`}
                  onContextMenu={(event) =>
                    openMenu(event, [
                      {
                        icon: Eye,
                        label: "打开",
                        onClick: () =>
                          onSelect({
                            kind: "screen",
                            screenId: reference.id,
                            nodePath: "",
                          }),
                      },
                      "separator",
                      {
                        icon: Pencil,
                        label: "重命名/移动…",
                        onClick: () => onRenameScreen(reference.file),
                      },
                      {
                        icon: Copy,
                        label: "复制副本",
                        onClick: () => onDuplicateScreen(reference.file),
                      },
                      "separator",
                      {
                        icon: Trash2,
                        label: "删除页面…",
                        danger: true,
                        onClick: () => onRemoveScreen(reference.file),
                      },
                    ])
                  }
                >
                  <button
                    className="tree-screen"
                    onClick={() =>
                      onSelect({ kind: "screen", screenId: reference.id, nodePath: "" })
                    }
                    title={reference.file}
                  >
                    <AppWindow size={13} className="tree-icon" />
                    {screen?.name ?? reference.id}
                  </button>
                  <span className="tree-row-actions">
                    <button
                      className="tree-action"
                      onClick={() => onRenameScreen(reference.file)}
                      title="重命名/移动文件"
                    >
                      <Pencil size={12} />
                    </button>
                    <button
                      className="tree-action"
                      onClick={() => onDuplicateScreen(reference.file)}
                      title="复制页面"
                    >
                      <Copy size={12} />
                    </button>
                    <button
                      className="tree-action tree-action-danger"
                      onClick={() => onRemoveScreen(reference.file)}
                      title="删除页面"
                    >
                      <Trash2 size={12} />
                    </button>
                  </span>
                </div>
                {active && screen ? (
                  <ul className="tree-nodes">
                    {screen.body.map((node, index) => (
                      <TreeNode
                        key={node.id}
                        screenId={reference.id}
                        node={node}
                        path={`body/${index}`}
                        selection={selection}
                        collapsed={collapsed}
                        onToggle={toggleNode}
                        onSelect={onSelect}
                      />
                    ))}
                  </ul>
                ) : null}
              </li>
            );
          })}
        </ul>
      </div>

      <div className="tree-section">
        <div className="tree-heading tree-heading-row">
          预览场景
          <button
            className="tree-action"
            onClick={onAddFixture}
            title="新建场景（复制基础 fixture）"
          >
            <Plus size={13} />
          </button>
        </div>
        <ul className="tree-screens">
          {[FIXTURE_FILE, ...fixtureScenarios].map((file) => {
            const isBase = file === FIXTURE_FILE;
            const active = selection?.kind === "file" && selection.file === file;
            const inUse = file === activeFixture;
            return (
              <li key={file}>
                <div
                  className={`tree-screen-row${active ? " active" : ""}`}
                  onContextMenu={(event) =>
                    openMenu(event, [
                      {
                        icon: Eye,
                        label: "打开",
                        onClick: () => onSelect({ kind: "file", file }),
                      },
                      ...(isBase
                        ? []
                        : ([
                            "separator",
                            {
                              icon: Pencil,
                              label: "重命名/移动…",
                              onClick: () => onRenameFixture(file),
                            },
                            "separator",
                            {
                              icon: Trash2,
                              label: "删除场景…",
                              danger: true,
                              onClick: () => onRemoveFile(file),
                            },
                          ] as const)),
                    ])
                  }
                >
                  <button
                    className="tree-screen tree-file"
                    onClick={() => onSelect({ kind: "file", file })}
                    title={file}
                  >
                    <FlaskConical size={13} className="tree-icon" />
                    {fixtureLabel(file)}
                    {inUse ? <span className="tree-badge tree-badge-player">使用中</span> : null}
                  </button>
                  {isBase ? null : (
                    <span className="tree-row-actions">
                      <button
                        className="tree-action"
                        onClick={() => onRenameFixture(file)}
                        title="重命名/移动文件"
                      >
                        <Pencil size={12} />
                      </button>
                      <button
                        className="tree-action tree-action-danger"
                        onClick={() => onRemoveFile(file)}
                        title="删除场景"
                      >
                        <Trash2 size={12} />
                      </button>
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      {otherFiles.length > 0 ? (
        <div className="tree-section">
          <div className="tree-heading">其他文件</div>
          <ul className="tree-screens">
            {otherFiles.map((file) => {
              const active = selection?.kind === "file" && selection.file === file;
              return (
                <li key={file}>
                  <div
                    className={`tree-screen-row${active ? " active" : ""}`}
                    onContextMenu={(event) =>
                      openMenu(event, [
                        {
                          icon: Eye,
                          label: "打开",
                          onClick: () => onSelect({ kind: "file", file }),
                        },
                        "separator",
                        {
                          icon: Trash2,
                          label: "删除文件…",
                          danger: true,
                          onClick: () => onRemoveFile(file),
                        },
                      ])
                    }
                  >
                    <button
                      className="tree-screen tree-file"
                      onClick={() => onSelect({ kind: "file", file })}
                      title={file}
                    >
                      <FileJson2 size={13} className="tree-icon" />
                      {file}
                    </button>
                    <span className="tree-row-actions">
                      <button
                        className="tree-action tree-action-danger"
                        onClick={() => onRemoveFile(file)}
                        title="删除文件"
                      >
                        <Trash2 size={12} />
                      </button>
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
      {menu ? <ContextMenu state={menu} onClose={closeMenu} /> : null}
    </div>
  );
}

/** 子槽位中文名：仅在多槽位（如 each 的 template/empty）时显示。 */
const SLOT_LABELS: Record<string, string> = {
  content: "内容",
  template: "模板",
  empty: "空态",
};

/** 段路径的祖先节点路径（不含自身）。`body/0/content/1` → `["body/0"]`。 */
function ancestorNodePaths(path: string): string[] {
  const parts = path.split("/");
  const result: string[] = [];
  for (let i = 2; i < parts.length; i += 2) {
    result.push(parts.slice(0, i).join("/"));
  }
  return result;
}

interface TreeNodeProps {
  screenId: string;
  node: UiNode;
  path: string;
  selection: Selection | null;
  /** 已折叠节点的 key 集合（`${screenId}:${path}`）。 */
  collapsed: ReadonlySet<string>;
  onToggle(key: string): void;
  onSelect(selection: Selection): void;
}

function TreeNode({ screenId, node, path, selection, collapsed, onToggle, onSelect }: TreeNodeProps) {
  const selected =
    selection?.kind === "screen" &&
    selection.screenId === screenId &&
    selection.nodePath === path;
  const slots = nodeChildSlots(node);
  const childCount = slots.reduce((sum, slot) => sum + slot.nodes.length, 0);
  const hasChildren = childCount > 0;
  const nodeKey = `${screenId}:${path}`;
  const isCollapsed = collapsed.has(nodeKey);
  const display = nodeDisplayParts(node);
  const Icon = nodeTypeIcon(node.type);
  const showSlotLabels = slots.length > 1;
  return (
    <li>
      <div className={`tree-node${selected ? " active" : ""}`}>
        {hasChildren ? (
          <button
            type="button"
            className="tree-chevron"
            aria-expanded={!isCollapsed}
            aria-label={isCollapsed ? "展开子节点" : "折叠子节点"}
            onClick={() => onToggle(nodeKey)}
          >
            {isCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
          </button>
        ) : (
          <span className="tree-chevron-spacer" />
        )}
        <button
          type="button"
          className="tree-node-hit"
          onClick={() => onSelect({ kind: "screen", screenId, nodePath: path })}
          title={`#${node.id}`}
        >
          <Icon size={13} className="tree-icon" />
          <span className="tree-node-text">
            {display.main}
            {display.hint ? <span className="tree-dim tree-node-hint">{display.hint}</span> : null}
            {isCollapsed && childCount > 0 ? (
              <span className="tree-dim tree-node-hint">{childCount} 项</span>
            ) : null}
          </span>
        </button>
      </div>
      {isCollapsed
        ? null
        : slots.map((slot) => (
            <ul key={slot.key} className="tree-nodes">
              {showSlotLabels ? (
                <li className="tree-slot-label">{SLOT_LABELS[slot.key] ?? slot.key}</li>
              ) : null}
              {slot.nodes.map((child, index) => (
                <TreeNode
                  key={child.id}
                  screenId={screenId}
                  node={child}
                  path={`${path}/${slot.key}/${index}`}
                  selection={selection}
                  collapsed={collapsed}
                  onToggle={onToggle}
                  onSelect={onSelect}
                />
              ))}
            </ul>
          ))}
    </li>
  );
}
