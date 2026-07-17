/**
 * main.ts — 入口
 *
 *   node panel/index.js                  TUI 模式（默认）
 *   node panel/index.js --cli            CLI: 打印模块/服务状态
 *   node panel/index.js --no-tui         启动服务不进入 TUI
 *   node panel/index.js --help           帮助
 */

import { execSync, spawn } from "node:child_process";
import http from "node:http";
import process from "node:process";

const argv = process.argv.slice(2);
if (argv.includes("--help") || argv.includes("-h")) {
  console.log(`BDS Panel — 管理面板

用法:
  node panel/index.js                  TUI 模式（默认）
  node panel/index.js --cli            CLI 模式：打印模块/服务状态并退出
  node panel/index.js --no-tui         启动服务不进入 TUI
  node panel/index.js --help           显示本帮助

环境变量:
  PANEL_CLI=1        等价于 --cli
  PANEL_NO_TUI=1     等价于 --no-tui
`);
  process.exit(0);
}

const CLI_MODE = argv.includes("--cli") || process.env["PANEL_CLI"] === "1";
const NO_TUI = argv.includes("--no-tui") || process.env["PANEL_NO_TUI"] === "1";

function hasTTY(): boolean {
  return Boolean(process.stdin.isTTY && process.stdout.isTTY);
}

function httpJson(urlPath: string, method = "GET", payload?: unknown): Promise<{ status: number; body: unknown }> {
  return new Promise((resolve, reject) => {
    const data = payload ? JSON.stringify(payload) : "";
    const port = parseInt(process.env["DB_PORT"] ?? "3001", 10);
    const req = http.request(
      {
        hostname: "127.0.0.1",
        port,
        path: urlPath,
        method,
        timeout: 4000,
        headers: data ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(data) } : {},
      },
      (res) => {
        let body = "";
        res.on("data", (c) => (body += c));
        res.on("end", () => {
          try {
            resolve({ status: res.statusCode ?? 0, body: JSON.parse(body) });
          } catch {
            resolve({ status: res.statusCode ?? 0, body });
          }
        });
      }
    );
    req.on("error", reject);
    req.on("timeout", () => req.destroy(new Error("timeout")));
    if (data) req.write(data);
    req.end();
  });
}

async function waitForDb(timeoutMs = 10000): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const r = await httpJson("/api/health");
      if (r.status === 200) return true;
    } catch {
      /* keep trying */
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  return false;
}

function killProc(child: ReturnType<typeof spawn> | null): void {
  if (!child || child.killed) return;
  try {
    if (process.platform === "win32") {
      execSync(`taskkill /F /PID ${child.pid} /T 2>nul`, { stdio: "ignore" });
    } else {
      try {
        child.kill("SIGTERM");
      } catch {
        /* ignore */
      }
    }
  } catch {
    /* ignore */
  }
}

const procs: Array<ReturnType<typeof spawn>> = [];

function startProc(name: string, scriptPath: string): ReturnType<typeof spawn> {
  const child = spawn(process.execPath, [scriptPath], {
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout?.on("data", (d: Buffer) => process.stdout.write(`[${name}] ${d}`));
  child.stderr?.on("data", (d: Buffer) => process.stderr.write(`[${name}] ${d}`));
  child.on("exit", (code) => console.log(`[${name}] 已退出 code=${code}`));
  procs.push(child);
  return child;
}

function shutdownAll(): void {
  for (const p of procs) killProc(p);
}

process.on("SIGINT", () => {
  shutdownAll();
  process.exit(130);
});
process.on("SIGTERM", () => {
  shutdownAll();
  process.exit(143);
});

/* ============================================================
 *  CLI 模式
 * ============================================================ */
async function runCli(): Promise<void> {
  console.log("[cli] 启动 db-server / qq-bridge");
  startProc("db", "db-server/server.js");
  startProc("qq", "qq-bridge/index.js");
  const ok = await waitForDb();
  if (!ok) {
    console.error("[cli] db-server 不可达");
    shutdownAll();
    process.exit(1);
  }
  try {
    const r = await httpJson("/api/sfmc/modules");
    const mods = (r.body as { modules?: Array<{ id: string; type?: string; enabled?: boolean }> }).modules ?? [];
    console.log(`[cli] 模块 (${mods.length}):`);
    for (const m of mods.slice(0, 30)) {
      console.log(`  ${m.id.padEnd(24)} [${m.type ?? "feature"}] ${m.enabled ? "启用" : "禁用"}`);
    }
  } catch {
    /* ignore */
  }
  shutdownAll();
  process.exit(0);
}

/* ============================================================
 *  no-tui 模式
 * ============================================================ */
async function runNoTui(): Promise<void> {
  startProc("db", "db-server/server.js");
  startProc("qq", "qq-bridge/index.js");
  const ok = await waitForDb();
  if (!ok) {
    console.error("[panel] db-server 启动超时");
    shutdownAll();
    process.exit(1);
  }
  console.log("[panel] 服务已启动，按 Ctrl+C 退出");
  await new Promise(() => {});
}

/* ============================================================
 *  TUI 模式（默认）
 * ============================================================ */
async function runTui(): Promise<void> {
  if (!hasTTY()) {
    console.error("[panel] 当前环境不是 TTY（管道 / IDE / 子进程）");
    console.error("[panel] 解决: 交互终端直接运行，或 --cli / --no-tui");
    process.exit(2);
  }
  // 启动 db/qq 后台
  startProc("db", "db-server/server.js");
  startProc("qq", "qq-bridge/index.js");
  await waitForDb().catch(() => {});

  const { render } = await import("ink");
  const React = await import("react");
  const { App } = await import("./app.js");
  const { startMonitor } = await import("./monitor/collector.js");
  const { bindServiceOutput, pushLog, closeLogFile } = await import("./log/buffer.js");
  const { services, stopAll } = await import("./services/manager.js");
  const { loadHistory } = await import("./input/history.js");

  bindServiceOutput(services as unknown as Parameters<typeof bindServiceOutput>[0]);
  loadHistory();
  startMonitor();
  pushLog("Panel 启动完成", "success");

  const cleanup = (): void => {
    closeLogFile();
    void stopAll();
    shutdownAll();
  };
  process.on("exit", cleanup);
  process.once("SIGINT", () => {
    cleanup();
    process.exit(0);
  });
  process.once("SIGTERM", () => {
    cleanup();
    process.exit(0);
  });

  const instance = render(React.createElement(App));
  await instance.waitUntilExit();
}

/* ============================================================
 *  分发
 * ============================================================ */
if (CLI_MODE) {
  await runCli();
} else if (NO_TUI) {
  await runNoTui();
} else {
  await runTui();
}
