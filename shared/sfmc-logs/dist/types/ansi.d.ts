/**
 * ansi.ts — 纯 ANSI 颜色码工具 (零依赖,不引入 chalk)
 *
 * 共享日志包必须零运行时依赖,因此直接用 ANSI 转义码。
 * 颜色码与 sfmc/src/theme.ts 的配色对齐 (One Dark 风格)。
 */
export declare const ansi: {
    readonly reset: "\u001B[0m";
    readonly bold: "\u001B[1m";
    readonly dim: "\u001B[2m";
    readonly red: "\u001B[31m";
    readonly green: "\u001B[32m";
    readonly yellow: "\u001B[33m";
    readonly blue: "\u001B[34m";
    readonly cyan: "\u001B[36m";
    readonly gray: "\u001B[90m";
};
/** 移除字符串中所有 ANSI 转义码 */
export declare function stripAnsi(s: string): string;
/** 计算字符串可见长度 (排除 ANSI 码) */
export declare function visibleLen(s: string): number;
/** 检测流是否支持颜色 (尊重 NO_COLOR / FORCE_COLOR 环境变量) */
export declare function supportsColor(stream: {
    isTTY?: boolean;
}): boolean;
/** 用 ANSI 颜色包裹字符串 */
export declare function wrap(color: keyof typeof ansi, s: string): string;
