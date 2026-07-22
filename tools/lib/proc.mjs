/**
 * tools/lib/proc.mjs — 子进程辅助
 */
import { spawn, execSync } from "node:child_process";
import process from "node:process";

/**
 * @param {string} cmd
 * @param {string[]} args
 * @param {import("node:child_process").SpawnSyncOptions} [opts]
 */
export function runSync(cmd, args, opts = {}) {
  try {
    const stdout = execSync([quote(cmd), ...args.map(quote)].join(" "), {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      ...opts,
    });
    return { status: 0, stdout: stdout || "", stderr: "" };
  } catch (e) {
    return {
      status: typeof e.status === "number" ? e.status : 1,
      stdout: e.stdout || "",
      stderr: e.stderr || "",
    };
  }
}

/** @param {string} s */
function quote(s) {
  return /\s/.test(s) ? `"${s}"` : s;
}

/**
 * @param {string} cmd
 * @param {string[]} args
 * @param {import("node:child_process").SpawnOptions} [opts]
 */
export function spawnNode(cmd, args, opts = {}) {
  return spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"], ...opts });
}

/** @param {number | undefined} pid */
export async function killProc(pid) {
  if (!pid) return;
  try {
    if (process.platform === "win32") {
      execSync(`taskkill /F /PID ${pid} /T 2>nul`, { stdio: "ignore" });
    } else {
      try {
        process.kill(pid, "SIGTERM");
      } catch {
        /* ignore */
      }
    }
    await new Promise((r) => setTimeout(r, 400));
  } catch {
    /* ignore */
  }
}
