import chalk from "chalk";
export const T = {
    bg: "#282c34",
    panel: "#21252b",
    surface: "#2c313c",
    surfaceHi: "#3e4452",
    subtle: "#4b5263",
    text: "#dcdfe4",
    muted: "#888888",
    red: "#e06c75",
    green: "#98c379",
    yellow: "#e5c07b",
    blue: "#61afef",
    cyan: "#56b6c2",
    purple: "#c678dd",
    orange: "#d19a66",
};
export const c = {
    dim: chalk.hex(T.muted),
    text: chalk.hex(T.text),
    green: chalk.hex(T.green),
    red: chalk.hex(T.red),
    yellow: chalk.hex(T.yellow),
    blue: chalk.hex(T.blue),
    cyan: chalk.hex(T.cyan),
    purple: chalk.hex(T.purple),
    orange: chalk.hex(T.orange),
    bold: chalk.bold,
};
export const W = 58;
export function highlightLogLine(raw) {
    return raw
        .replace(/§[0-9a-fklmnor]/g, "")
        .replace(/\b\d{1,2}:\d{2}(?::\d{2})?\b/g, (m) => c.dim(m))
        .replace(/\[ERROR\]/g, (m) => c.red(m))
        .replace(/\[FATAL\]/g, (m) => c.red(c.bold(m)))
        .replace(/\[WARN(ING)?\]/g, (m) => c.yellow(m))
        .replace(/\[SUCCESS\]/g, (m) => c.green(c.bold(m)))
        .replace(/\[INFO\]/g, (m) => c.blue(m))
        .replace(/\[DEBUG\]/g, (m) => c.dim(m))
        .replace(/\[PLAYER\]/g, (m) => c.green(m))
        .replace(/\[TPS\]/g, (m) => c.cyan(m))
        .replace(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}(:\d+)?\b/g, (m) => c.cyan(m))
        .replace(/Player (joined|left):/g, (m) => c.green(m))
        .replace(/Server (started|stopped)/g, (m) => c.green(m))
        .replace(/\b(TPS|MSPT|tick|loaded|saved)\b/gi, (m) => c.cyan(m));
}
function visibleLen(s) {
    return s.replace(/\x1b\[[0-9;]*m/g, "").length;
}
export const DIVIDER = c.dim("─".repeat(W - 2));
export function padRight(s, n) {
    return s + " ".repeat(Math.max(0, n - visibleLen(s)));
}
//# sourceMappingURL=theme.js.map