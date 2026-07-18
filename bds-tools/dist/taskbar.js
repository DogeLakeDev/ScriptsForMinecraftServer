"use strict";
/**
 * taskbar.ts — Windows Terminal 任务栏进度 (OSC 9;4)
 *
 * 通过 OSC 9;4 转义序列直接驱动 Windows Terminal 任务栏图标上的进度条。
 * 不需要 native 绑定(ffi / ITaskbarList3),但**仅 Windows Terminal 支持**。
 * cmd.exe / PowerShell ISE 等老终端会忽略该序列,本模块在不支持的终端
 * 上静默 no-op。
 *
 * 兼容性:
 *   - Windows Terminal  ✅
 *   - ConEmu / Cmder   ⚠️ 部分
 *   - cmd.exe / ISE    ❌(不解析 OSC)
 *
 * 检测方式:WT_SESSION 或 TERM_PROGRAM === "Windows Terminal"。
 *
 * 序列格式(Windows Terminal 私有):
 *   \x1b]9;4;0;\x07        清除(隐藏)
 *   \x1b]9;4;1;<pct>\x07   正常(绿,pct 0-100)
 *   \x1b]9;4;2;<pct>\x07   错误(红,pct 0-100)
 *   \x1b]9;4;3;\x07        不确定(动画条纹)
 *
 * 幂等:相同 state+pct 不重复输出,避免刷屏。
 *
 * 用法:
 *   setTaskbarProgress(50);              // 50% 绿
 *   setTaskbarProgress(100, "error");    // 100% 红
 *   clearTaskbarProgress();              // 隐藏
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.setTaskbarProgress = setTaskbarProgress;
exports.clearTaskbarProgress = clearTaskbarProgress;
exports.isTaskbarSupported = isTaskbarSupported;
function detect() {
    if (process.platform !== "win32")
        return false;
    if (process.env["WT_SESSION"])
        return true;
    if (process.env["TERM_PROGRAM"] === "Windows Terminal")
        return true;
    return false;
}
let supported = detect();
let active = false;
let lastPct = -1;
let lastState = 0;
function stateCode(s) {
    switch (s) {
        case "clear":
            return 0;
        case "normal":
            return 1;
        case "error":
            return 2;
        case "indeterminate":
            return 3;
    }
}
/**
 * 设置任务栏进度。
 * - normal: 绿色 (pct 0-100)
 * - error: 红色 (pct 0-100)
 * - indeterminate: 动画条纹(pct 忽略)
 */
function setTaskbarProgress(pct, state = "normal") {
    if (!supported)
        return;
    if (state === "indeterminate") {
        if (lastState === 3)
            return; // 已在 indeterminate,不再重发
        process.stdout.write("\x1b]9;4;3\x07");
        lastState = 3;
        lastPct = -1;
        active = true;
        return;
    }
    const p = Math.max(0, Math.min(100, Math.round(pct)));
    const sc = stateCode(state);
    if (lastState === sc && lastPct === p)
        return; // 无变化,跳过
    process.stdout.write(`\x1b]9;4;${sc};${p}\x07`);
    lastPct = p;
    lastState = sc;
    active = true;
}
/** 清除任务栏进度(隐藏进度条)。幂等。 */
function clearTaskbarProgress() {
    if (!supported || !active)
        return;
    process.stdout.write("\x1b]9;4;0\x07");
    lastPct = -1;
    lastState = 0;
    active = false;
}
/** 模块是否启用(Windows Terminal 探测结果)。供日志 / 调试。 */
function isTaskbarSupported() {
    return supported;
}
//# sourceMappingURL=taskbar.js.map