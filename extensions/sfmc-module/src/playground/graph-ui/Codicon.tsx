type CodiconProps = {
  /** 去掉 codicon- 前缀的图标 id，如 close、question */
  name: string;
  className?: string;
};

/** VS Code Codicon 字形（需在 webview HTML 引入 codicon.css） */
export function Codicon({ name, className }: CodiconProps) {
  return (
    <span
      className={`codicon codicon-${name}${className ? ` ${className}` : ""}`}
      aria-hidden
    />
  );
}
