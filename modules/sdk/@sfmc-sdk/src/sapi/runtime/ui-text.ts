/**
 * 移除 DDUI 按钮不支持的 Minecraft 格式化代码。
 *
 * 标题、标签和状态文本仍可按各自控件能力使用格式化代码；这里只用于按钮文字。
 */
export function stripDduiButtonFormatting(text: string): string {
  return text.replace(/§[0-9a-z]/gi, "");
}
