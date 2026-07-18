/**
 * ansi.ts — 纯 ANSI 颜色码工具 (零依赖,不引入 chalk)
 *
 * 共享日志包必须零运行时依赖,因此直接用 ANSI 转义码。
 * 颜色码与 sfmc/src/theme.ts 的配色对齐 (One Dark 风格)。
 */
export const ansi = {
    reset: "\x1b[0m",
    bold: "\x1b[1m",
    dim: "\x1b[2m",
    red: "\x1b[31m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    blue: "\x1b[34m",
    cyan: "\x1b[36m",
    gray: "\x1b[90m",
};
/** 移除字符串中所有 ANSI 转义码 */
export function stripAnsi(s) {
    // eslint-disable-next-line no-control-regex
    return s.replace(/\x1b\[[0-9;]*m/g, "");
}
/** 计算字符串可见长度 (排除 ANSI 码) */
export function visibleLen(s) {
    return stripAnsi(s).length;
}
/** 检测流是否支持颜色 (尊重 NO_COLOR / FORCE_COLOR 环境变量) */
export function supportsColor(stream) {
    if (process.env["NO_COLOR"])
        return false;
    if (process.env["FORCE_COLOR"])
        return true;
    return stream.isTTY === true;
}
/** 用 ANSI 颜色包裹字符串 */
export function wrap(color, s) {
    return `${ansi[color]}${s}${ansi.reset}`;
}
//# sourceMappingURL=ansi.js.map