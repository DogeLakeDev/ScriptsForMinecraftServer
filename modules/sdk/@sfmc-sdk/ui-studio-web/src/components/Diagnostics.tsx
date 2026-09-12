/**
 * Diagnostics.tsx — 底部诊断区。
 *
 * 展示共享校验器（compileUiProject）产出的统一问题列表；
 * 点击可定位到对应页面与组件（解析 JSON Pointer 路径）。
 */

import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { locateIssue, type ProjectView, type Selection } from "../model";

interface DiagnosticsProps {
  view: ProjectView;
  onLocate(selection: Selection): void;
}

export function Diagnostics({ view, onLocate }: DiagnosticsProps) {
  const issues = view.issues;
  return (
    <div className="diagnostics">
      <span className={`diagnostics-count${issues.length > 0 ? " has-issues" : ""}`}>
        {issues.length > 0 ? (
          <AlertTriangle size={13} />
        ) : (
          <CheckCircle2 size={13} />
        )}
        问题：{issues.length}
      </span>
      {issues.length === 0 ? (
        <span className="diagnostics-ok">结构与语义校验全部通过</span>
      ) : (
        <ul className="diagnostics-list">
          {issues.map((issue, index) => {
            const target = locateIssue(view, issue);
            return (
              <li key={index}>
                <button
                  className="diagnostics-item"
                  disabled={!target}
                  onClick={() => target && onLocate(target)}
                  title={target ? "点击定位" : "工程级问题"}
                >
                  <code className="diagnostics-code">{issue.code}</code>
                  <span className="diagnostics-path">{issue.path || "（根）"}</span>
                  <span>{issue.message}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
