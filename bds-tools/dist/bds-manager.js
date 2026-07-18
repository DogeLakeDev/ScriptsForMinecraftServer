"use strict";
/**
 * bds-manager.ts — BDS 进程管理器
 *
 * 改进:
 *  - 优雅 stop (发送 stop 命令 → 等待退出 → SIGTERM → SIGKILL)
 *  - watchdog (崩溃自动重启)
 *  - 单例事件发射器
 *  - 完全异步 (fs/promises)
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.bdsEvents_enabled = exports.bdsEvents = void 0;
exports.createBdsManager = createBdsManager;
const node_child_process_1 = require("node:child_process");
const node_util_1 = require("node:util");
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const node_events_1 = require("node:events");
const paths_js_1 = require("./paths.js");
const logger_js_1 = require("./logger.js");
const execAsync = (0, node_util_1.promisify)(node_child_process_1.exec);
let cached = null;
function readPid() {
    try {
        return parseInt(node_fs_1.default.readFileSync(paths_js_1.PID_FILE, "utf-8").trim(), 10) || 0;
    }
    catch {
        return 0;
    }
}
function writePid(pid) {
    try {
        node_fs_1.default.writeFileSync(paths_js_1.PID_FILE, String(pid));
    }
    catch {
        /* ignore */
    }
}
function clearPid() {
    try {
        if (node_fs_1.default.existsSync(paths_js_1.PID_FILE))
            node_fs_1.default.unlinkSync(paths_js_1.PID_FILE);
    }
    catch {
        /* ignore */
    }
}
async function isAlive(pid) {
    if (!pid)
        return false;
    try {
        if (process.platform === "win32") {
            const { stdout } = await execAsync(`tasklist /fi "PID eq ${pid}" /nh`, { windowsHide: true });
            return stdout.includes(String(pid));
        }
        process.kill(pid, 0);
        return true;
    }
    catch {
        return false;
    }
}
function ensureProc() {
    if (cached)
        return cached;
    const cfg = (0, paths_js_1.loadConfig)();
    const bds_path = node_path_1.default.resolve(cfg.bds_path || process.cwd());
    const exePath = node_path_1.default.join(bds_path, "bedrock_server.exe");
    cached = {
        process: null,
        isManualStop: false,
        crashRestart: cfg.crash_restart !== false,
        crashDelayMs: (cfg.crash_restart_delay ?? 5) * 1000,
        exePath,
        bdsPath: bds_path,
    };
    return cached;
}
function createBdsManager() {
    const events = new node_events_1.EventEmitter();
    events.setMaxListeners(100);
    const sendCommand = (cmd) => {
        const p = ensureProc();
        const pid = readPid();
        if (!pid || !isAlive(pid)) {
            logger_js_1.logger.warn("BDS 未运行");
            return false;
        }
        if (p.process && p.process.pid === pid && p.process.stdin) {
            try {
                p.process.stdin.write(cmd + "\n");
                logger_js_1.logger.info(`已发送命令: ${cmd}`);
                return true;
            }
            catch {
                return false;
            }
        }
        logger_js_1.logger.warn("BDS 由外部启动，无法发送命令到 stdin");
        return false;
    };
    const stop = async () => {
        const p = ensureProc();
        const pid = readPid();
        if (!pid || !(await isAlive(pid))) {
            logger_js_1.logger.info("BDS 未运行");
            clearPid();
            return;
        }
        if (p.process && p.process.pid === pid && p.process.stdin) {
            p.isManualStop = true;
            logger_js_1.logger.info("正在关闭 BDS...");
            try {
                p.process.stdin.write("stop\n");
            }
            catch (e) {
                logger_js_1.logger.warn(`发送 stop 命令失败: ${e.message}`);
            }
            await Promise.race([
                new Promise((resolve) => p.process?.once("exit", () => resolve())),
                new Promise((resolve) => setTimeout(() => {
                    logger_js_1.logger.warn("30s 超时，强制终止...");
                    try {
                        p.process?.kill("SIGTERM");
                    }
                    catch { }
                    setTimeout(resolve, 5000);
                }, 30_000)),
            ]);
            if (p.process && p.process.exitCode === null) {
                logger_js_1.logger.warn("强制结束进程...");
                try {
                    p.process.kill("SIGKILL");
                }
                catch { }
            }
        }
        else {
            // 外部启动的 BDS — fallback 使用 taskkill / pkill
            logger_js_1.logger.info("BDS 由外部启动，使用 taskkill...");
            try {
                if (process.platform === "win32") {
                    await execAsync("taskkill /f /im bedrock_server.exe", { windowsHide: true });
                }
                else {
                    await execAsync("pkill -f bedrock_server", { windowsHide: true });
                }
            }
            catch {
                /* ignore */
            }
        }
        clearPid();
        p.process = null;
        logger_js_1.logger.info("BDS 已停止");
    };
    const start = async () => {
        const p = ensureProc();
        const existing = readPid();
        if (existing && (await isAlive(existing))) {
            logger_js_1.logger.info("BDS 已在运行中");
            return;
        }
        if (!node_fs_1.default.existsSync(p.exePath)) {
            logger_js_1.logger.error(`未找到 ${p.exePath}`);
            throw new Error(`bedrock_server.exe 不存在: ${p.exePath}`);
        }
        logger_js_1.logger.info("正在启动 BDS...");
        const child = (0, node_child_process_1.spawn)(p.exePath, [], {
            cwd: p.bdsPath,
            stdio: ["pipe", "pipe", "pipe"],
            windowsHide: true,
        });
        p.process = child;
        writePid(child.pid ?? 0);
        logger_js_1.logger.info(`BDS 已启动 (PID: ${child.pid})`);
        child.stdout?.on("data", (chunk) => {
            const text = chunk.toString();
            events.emit("output", text);
            if (require.main === module)
                process.stdout.write(text);
        });
        child.stderr?.on("data", (chunk) => {
            const text = `[STDERR] ${chunk.toString()}`;
            events.emit("output", text);
            if (require.main === module)
                process.stderr.write(text);
        });
        child.on("exit", (code) => {
            logger_js_1.logger.info(`BDS 已退出 (code: ${code})`);
            clearPid();
            p.process = null;
            if (!p.isManualStop && p.crashRestart && isMain()) {
                logger_js_1.logger.info(`BDS 意外退出，${p.crashDelayMs / 1000}s 后自动重启...`);
                setTimeout(() => {
                    start().catch((e) => logger_js_1.logger.error(`自动重启失败: ${e.message}`));
                }, p.crashDelayMs);
            }
            p.isManualStop = false;
        });
    };
    const status = async () => {
        const pid = readPid();
        const alive = pid > 0 && (await isAlive(pid));
        if (alive) {
            console.log(`BDS 运行中 (PID: ${pid})`);
        }
        else {
            console.log("BDS 未运行");
            clearPid();
        }
        return alive;
    };
    const watch = async () => {
        logger_js_1.logger.info("启动监护模式...");
        while (true) {
            const pid = readPid();
            if (!pid || !(await isAlive(pid))) {
                try {
                    await start();
                }
                catch (e) {
                    logger_js_1.logger.error(`自动启动失败: ${e.message}`);
                }
            }
            await new Promise((r) => setTimeout(r, 5_000));
        }
    };
    const getPid = () => {
        const p = ensureProc();
        return p.process?.pid ?? readPid();
    };
    return {
        start,
        stop,
        status,
        sendCommand,
        watch,
        events,
        isManualStop: false,
        getPid,
    };
}
exports.bdsEvents = new node_events_1.EventEmitter();
const bdsEvents_enabled = () => { exports.bdsEvents.setMaxListeners(100); };
exports.bdsEvents_enabled = bdsEvents_enabled;
(0, exports.bdsEvents_enabled)();
/** 判断当前是否作为 CLI 主入口运行 */
function isMain() {
    if (require.main === module)
        return true;
    // 兼容 CJS 编译产物的 require.main 不等于当前 module 场景
    // 若 process.argv[1] 指向本文件 → 主入口
    const entry = process.argv[1] ?? "";
    return entry.endsWith("bds-manager.js") || entry.endsWith("bds-manager.ts");
}
// CLI 入口
if (isMain()) {
    const cmd = process.argv[2];
    const bds = createBdsManager();
    const args = process.argv.slice(3);
    switch (cmd) {
        case "start":
            bds.start().catch((e) => logger_js_1.logger.error(`启动失败: ${e.message}`));
            break;
        case "stop":
            bds.stop().catch((e) => logger_js_1.logger.error(`停止失败: ${e.message}`));
            break;
        case "restart":
            bds.stop()
                .then(() => bds.start())
                .catch((e) => logger_js_1.logger.error(`重启失败: ${e.message}`));
            break;
        case "status":
            bds.status();
            break;
        case "send":
            if (args[0])
                bds.sendCommand(args.join(" "));
            else
                console.log("用法: node bds-manager.js send <command>");
            break;
        case "watch":
            bds.watch().catch((e) => logger_js_1.logger.error(`监护异常: ${e.message}`));
            break;
        default:
            console.log(`用法:
  start         启动 BDS
  stop          停止
  restart       重启
  status        检查状态
  send <cmd>    发送命令
  watch         监护模式（崩溃自动重启）`);
    }
}
//# sourceMappingURL=bds-manager.js.map