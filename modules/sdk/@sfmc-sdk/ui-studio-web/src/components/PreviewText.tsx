/**
 * PreviewText.tsx — 预览里把 {{path}} 原样画出并加背景高亮。
 *
 * 不把未绑定变量收成空串（否则排行文案会变成「#  · 成员  · 公账」）。
 * 求值仍只发生在 Runtime / 动作 input；此处只做编辑器可见性。
 */

import { splitTemplateParts } from "../../../src/ui-studio/shared/evaluate.js";

/** 把模板字符串渲染为「静态文本 + 高亮绑定」片段。 */
export function PreviewText({ value }: { value: string }) {
  const parts = splitTemplateParts(value);
  return (
    <>
      {parts.map((part, index) =>
        part.kind === "text" ? (
          part.text
        ) : (
          <span key={`bind-${index}`} className="pv-bind" title={part.path}>
            {part.raw}
          </span>
        ),
      )}
    </>
  );
}
