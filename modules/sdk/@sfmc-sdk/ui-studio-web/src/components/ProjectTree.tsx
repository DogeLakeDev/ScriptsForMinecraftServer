/**
 * ProjectTree.tsx — 左栏：工程 / 页面 / 组件树。
 *
 * Feature 节点展示入口清单；每个页面可展开查看组件树（含 when/each 嵌套）。
 * 点击页面切换画布，点击组件与画布/属性面板联动选中。
 */

import type { UiNode } from "../../../src/contracts/ui-document.js";
import type { UiStudioProjectSnapshot } from "../../../src/ui-studio/project.js";
import { nodeChildSlots, nodeDisplayName, type Selection } from "../model";

interface ProjectTreeProps {
  snapshot: UiStudioProjectSnapshot;
  selection: Selection | null;
  onSelectScreen(screenId: string): void;
  onSelectNode(screenId: string, nodePath: string): void;
}

export function ProjectTree({
  snapshot,
  selection,
  onSelectScreen,
  onSelectNode,
}: ProjectTreeProps) {
  const feature = snapshot.browse.feature;
  const screens = snapshot.browse.screens;
  if (!feature) {
    return <div className="tree-empty">feature.ui.json 不可用，请先修复诊断中的问题</div>;
  }
  return (
    <div className="tree">
      <div className="tree-section">
        <div className="tree-heading">Feature</div>
        <div className="tree-feature" title={feature.moduleId}>
          {feature.name ?? feature.moduleId}
        </div>
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
      </div>
      <div className="tree-section">
        <div className="tree-heading">页面</div>
        <ul className="tree-screens">
          {feature.screens.map((reference) => {
            const screen = screens[reference.id];
            const active = selection?.screenId === reference.id;
            return (
              <li key={reference.id}>
                <button
                  className={`tree-screen${active ? " active" : ""}`}
                  onClick={() => onSelectScreen(reference.id)}
                  title={reference.file}
                >
                  {screen?.name ?? reference.id}
                </button>
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
                        onSelectNode={onSelectNode}
                      />
                    ))}
                  </ul>
                ) : null}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

interface TreeNodeProps {
  screenId: string;
  node: UiNode;
  path: string;
  depth: number;
  selection: Selection | null;
  onSelectNode(screenId: string, nodePath: string): void;
}

function TreeNode({ screenId, node, path, depth, selection, onSelectNode }: TreeNodeProps) {
  const selected = selection?.screenId === screenId && selection.nodePath === path;
  const slots = nodeChildSlots(node);
  return (
    <li>
      <button
        className={`tree-node${selected ? " active" : ""}`}
        style={{ paddingLeft: 8 + depth * 14 }}
        onClick={() => onSelectNode(screenId, path)}
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
              onSelectNode={onSelectNode}
            />
          ))}
        </ul>
      ))}
    </li>
  );
}
