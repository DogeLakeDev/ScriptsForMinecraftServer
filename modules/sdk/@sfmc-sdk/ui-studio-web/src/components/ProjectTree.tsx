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
  Copy,
  Eye,
  FileJson2,
  Package,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import {
  FEATURE_FILE,
  nodeChildSlots,
  nodeDisplayName,
  type ProjectView,
  type Selection,
} from "../model";
import { screenRefs } from "../store/project";
import { ContextMenu, useContextMenu } from "./ContextMenu";

interface ProjectTreeProps {
  view: ProjectView;
  selection: Selection | null;
  onSelect(selection: Selection): void;
  onAddScreen(): void;
  onRenameScreen(file: string): void;
  onDuplicateScreen(file: string): void;
  onRemoveScreen(file: string): void;
  onRemoveFile(file: string): void;
}

export function ProjectTree({
  view,
  selection,
  onSelect,
  onAddScreen,
  onRenameScreen,
  onDuplicateScreen,
  onRemoveScreen,
  onRemoveFile,
}: ProjectTreeProps) {
  const feature = view.browse.feature;
  const screens = view.browse.screens;
  const declared = new Set(screenRefs(view.files).map((ref) => ref.file));
  const otherFiles = Object.keys(view.files)
    .filter((file) => file !== FEATURE_FILE && !declared.has(file))
    .sort();
  // 右键菜单状态：页面行与其他文件行共用。
  const { menu, open: openMenu, close: closeMenu } = useContextMenu();

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
            {feature.entries.map((entry) => (
              <li key={entry.id} title={`${entry.surface} / ${entry.group}`}>
                <span className={`tree-badge tree-badge-${entry.surface}`}>
                  {entry.surface === "admin" ? "管理" : "玩家"}
                </span>
                {entry.title}
                <span className="tree-dim"> → {entry.target}</span>
              </li>
            ))}
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
                        depth={0}
                        selection={selection}
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

interface TreeNodeProps {
  screenId: string;
  node: UiNode;
  path: string;
  depth: number;
  selection: Selection | null;
  onSelect(selection: Selection): void;
}

function TreeNode({ screenId, node, path, depth, selection, onSelect }: TreeNodeProps) {
  const selected =
    selection?.kind === "screen" &&
    selection.screenId === screenId &&
    selection.nodePath === path;
  const slots = nodeChildSlots(node);
  return (
    <li>
      <button
        className={`tree-node${selected ? " active" : ""}`}
        style={{ paddingLeft: 8 + depth * 14 }}
        onClick={() => onSelect({ kind: "screen", screenId, nodePath: path })}
        title={`#${node.id}`}
      >
        {nodeDisplayName(node)}
      </button>
      {slots.map((slot) => (
        <ul key={slot.key} className="tree-nodes">
          {slot.nodes.map((child, index) => (
            <TreeNode
              key={child.id}
              screenId={screenId}
              node={child}
              path={`${path}/${slot.key}/${index}`}
              depth={depth + 1}
              selection={selection}
              onSelect={onSelect}
            />
          ))}
        </ul>
      ))}
    </li>
  );
}
