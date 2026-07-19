import { spawn } from "node:child_process";
import { EventEmitter } from "node:events";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { inferLevel, pushLog as pushUnifiedLog } from "./logs.js";
import { spawnService } from "./runtime.js";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(__dirname, "..", "..");
export const SERVICE_NAMES = ["bds", "db", "qq", "llbot"];
class Service {
    name;
    title;
    proc = null;
    running = false;
    pid = 0;
    startTime = null;
    logs = [];
    events = new EventEmitter();
    def;
    manualStop = false;
    constructor(def) {
        this.name = def.name;
        this.title = def.title;
        this.def = def;
    }
    get uptime() {
        if (!this.startTime || !this.running)
            return "—";
        const ms = Date.now() - this.startTime.getTime();
        const m = Math.floor(ms / 60000);
        const h = Math.floor(m / 60);
        if (h > 0)
            return `${h}h ${m % 60}m`;
        if (m > 0)
            return `${m}m`;
        return `${Math.floor(ms / 1000)}s`;
    }
    pushLog(text, stream) {
        const line = { time: new Date(), text, stream };
        this.logs.push(line);
        if (this.logs.length > 2000)
            this.logs.splice(0, this.logs.length - 2000);
        this.events.emit("log", line);
        // stderr 视为 error; stdout 用 inferLevel 推断 (bare 子进程纯 text 时默认 info,
        // BDS 等自带 [LEVEL] 标签的仍可正确推断)
        const level = stream === "stderr" ? "error" : inferLevel(text);
        pushUnifiedLog(text, this.name, level);
    }
    async start() {
        if (this.running)
            return;
        if (this.def.validate) {
            const v = this.def.validate();
            if (v)
                throw new Error(v);
        }
        this.manualStop = false;
        const spawnOpts = {
            cwd: this.def.cwd,
            stdio: ["pipe", "pipe", "pipe"],
            env: this.def.env ? { ...process.env, ...this.def.env } : process.env,
        };
        const child = this.def.service
            ? spawnService(this.def.service, this.def.args ?? [], spawnOpts)
            : spawn(this.def.cmd, this.def.args ?? [], spawnOpts);
        //child.unref();
        this.proc = child;
        this.pid = child.pid ?? 0;
        this.running = true;
        this.startTime = new Date();
        this.events.emit("output", `started (PID ${this.pid})`, "info");
        child.on("error", (e) => {
            this.events.emit("output", `process error: ${e.message}`, "error");
            this.cleanup();
        });
        child.stdout?.on("data", (d) => {
            for (const line of d.toString().split("\n").filter(Boolean)) {
                this.pushLog(line, "stdout");
            }
        });
        child.stderr?.on("data", (d) => {
            for (const line of d.toString().split("\n").filter(Boolean)) {
                this.pushLog(line, "stderr");
            }
        });
        child.on("exit", (code) => {
            this.events.emit("output", `exited (code: ${code})`, "info");
            this.cleanup();
            if (!this.manualStop && this.def.autoRestart) {
                setTimeout(() => {
                    void this.start();
                }, this.def.restartDelay);
            }
        });
    }
    async stop() {
        if (!this.proc || !this.running)
            return;
        this.manualStop = true;
        this.events.emit("output", "stopping...", "info");
        if (this.def.stopCommand && this.proc.stdin) {
            this.proc.stdin.write(this.def.stopCommand + "\n");
        }
        else {
            this.proc.kill("SIGTERM");
        }
        return new Promise((resolve) => {
            const timeout = setTimeout(() => {
                if (this.proc) {
                    this.events.emit("output", "force kill", "error");
                    try {
                        this.proc.kill("SIGKILL");
                    }
                    catch {
                        /* ignore */
                    }
                }
                resolve();
            }, this.def.stopTimeout);
            this.proc?.on("exit", () => {
                clearTimeout(timeout);
                resolve();
            });
        });
    }
    async restart() {
        await this.stop();
        await this.start();
    }
    getRecentLogs(n) {
        return this.logs.slice(-n);
    }
    cleanup() {
        this.proc = null;
        this.running = false;
        this.pid = 0;
    }
}
function loadJson(file) {
    try {
        const p = path.join(ROOT, "configs", file);
        return JSON.parse(fs.readFileSync(p, "utf-8"));
    }
    catch {
        return {};
    }
}
const bdsCfg = loadJson("bds_updater.json");
const qqCfg = loadJson("qq_config.json");
const dbCfg = loadJson("db_config.json");
const bdsPath = bdsCfg.bds_path ?? path.join(ROOT);
const llbotEnabled = qqCfg.llbot_enabled !== false;
const llbotPath = qqCfg.llbot_path ?? "D:\\LLBot-CLI-win-x64\\llbot.exe";
const llbotCwd = qqCfg.llbot_cwd ?? "D:\\LLBot-CLI-win-x64";
const dbPort = dbCfg.db_port ?? 3001;
const BDS_EXE = path.resolve(bdsPath, "bedrock_server.exe");
export const services = {
    bds: new Service({
        name: "bds",
        title: "BDS",
        cmd: BDS_EXE,
        args: [],
        cwd: bdsPath,
        stopCommand: "stop",
        stopTimeout: 30000,
        autoRestart: bdsCfg.crash_restart !== false,
        restartDelay: 5000,
        validate: () => {
            if (!fs.existsSync(BDS_EXE))
                return `not found: ${BDS_EXE}`;
            return null;
        },
    }),
    db: new Service({
        name: "db",
        title: "DB Server",
        service: "db",
        cwd: ROOT,
        stopTimeout: 10000,
        autoRestart: true,
        restartDelay: 3000,
        env: { DB_PORT: String(dbPort) },
    }),
    qq: new Service({
        name: "qq",
        title: "QQ Bridge",
        service: "qq",
        cwd: ROOT,
        stopTimeout: 10000,
        autoRestart: true,
        restartDelay: 3000,
    }),
    llbot: new Service({
        name: "llbot",
        title: "LLBot",
        cmd: llbotPath,
        args: [],
        cwd: llbotCwd,
        stopTimeout: 10000,
        autoRestart: false,
        restartDelay: 5000,
        validate: () => {
            if (!llbotEnabled)
                return "LLBot disabled (llbot_enabled=false)";
            if (!fs.existsSync(llbotPath))
                return `not found: ${llbotPath}`;
            return null;
        },
    }),
};
export const START_ORDER = ["db", "qq", "llbot", "bds"];
export async function startAll() {
    for (const name of START_ORDER) {
        const svc = services[name];
        if (!svc)
            continue;
        try {
            await svc.start();
        }
        catch (e) {
            svc.events.emit("output", `start error: ${e.message}`, "error");
        }
    }
}
export async function stopAll() {
    for (const name of [...START_ORDER].reverse()) {
        const svc = services[name];
        if (!svc?.running)
            continue;
        try {
            await svc.stop();
        }
        catch {
            /* ignore */
        }
    }
}
//# sourceMappingURL=services.js.map