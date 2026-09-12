/**
 * Inspector.tsx — 右栏：属性与声明查看（切片 1 为只读）。
 *
 * 选中组件时展示其声明 JSON；未选中组件时展示页面级声明
 * （params / state / load / derived / actions）摘要。
 * 编辑能力（属性面板、撤销重做、保存）在切片 2 接入。
 */

import type { UiStudioProjectSnapshot } from "../../../src/ui-studio/project.js";
import { nodeAtPath, type Selection } from "../model";

interface InspectorProps {
  snapshot: UiStudioProjectSnapshot;
  selection: Selection | null;
}

export function Inspector({ snapshot, selection }: InspectorProps) {
  const screen = selection ? snapshot.browse.screens[selection.screenId] : null;
  if (!screen) {
    return <div className="inspector-empty">在左侧选择页面或组件</div>;
  }
  const node = selection ? nodeAtPath(screen, selection.nodePath) : null;
  return (
    <div className="inspector">
      {node ? (
        <>
          <div className="inspector-heading">
            组件 <code>{node.type}</code> <span className="tree-dim">#{node.id}</span>
          </div>
          <pre className="inspector-json">{JSON.stringify(node, null, 2)}</pre>
        </>
      ) : (
        <>
          <div className="inspector-heading">
            页面 <code>{screen.id}</code>
          </div>
          <dl className="inspector-meta">
            <dt>呈现</dt>
            <dd>{screen.presentation}</dd>
            <dt>params</dt>
            <dd>{Object.keys(screen.params ?? {}).join("、") || "（无）"}</dd>
            <dt>state</dt>
            <dd>{Object.keys(screen.state ?? {}).join("、") || "（无）"}</dd>
            <dt>load</dt>
            <dd>{Object.keys(screen.load ?? {}).join("、") || "（无）"}</dd>
            <dt>derived</dt>
            <dd>{Object.keys(screen.derived ?? {}).join("、") || "（无）"}</dd>
            <dt>actions</dt>
            <dd>{Object.keys(screen.actions ?? {}).join("、") || "（无）"}</dd>
            <dt>组件数</dt>
            <dd>{screen.body.length}</dd>
          </dl>
          <pre className="inspector-json">{JSON.stringify(screen, null, 2)}</pre>
        </>
      )}
    </div>
  );
}
