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
type ProgressState = "normal" | "error" | "indeterminate";
/**
 * 设置任务栏进度。
 * - normal: 绿色 (pct 0-100)
 * - error: 红色 (pct 0-100)
 * - indeterminate: 动画条纹(pct 忽略)
 */
export declare function setTaskbarProgress(pct: number, state?: ProgressState): void;
/** 清除任务栏进度(隐藏进度条)。幂等。 */
export declare function clearTaskbarProgress(): void;
/** 模块是否启用(Windows Terminal 探测结果)。供日志 / 调试。 */
export declare function isTaskbarSupported(): boolean;
export {};
//# sourceMappingURL=taskbar.d.ts.map