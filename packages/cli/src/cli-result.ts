/**
 * CLI 命令结构化结果 —— 用 ok 布尔表达成败，勿解析着色/本地化文案。
 */
export type CliResult = {
  ok: boolean;
  message: string;
};

export function okResult(message: string): CliResult {
  return { ok: true, message };
}

export function failResult(message: string): CliResult {
  return { ok: false, message };
}

/** 仅取展示文本（供 console.log / stdout.write）。 */
export function resultText(r: CliResult): string {
  return r.message;
}
