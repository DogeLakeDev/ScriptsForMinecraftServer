/**
 * host.ts — 在登录会话之外启动守护进程
 *
 * 使用场景：桌面端通过 SSH 执行 `manage --stdio`，这条进程只是管理通道。
 * Windows OpenSSH 会在会话结束时关掉作业里的全部进程；systemd 在登出时也会结束本次登录的进程。
 * `detached` 仍留在该范围内，所以守护进程必须由会话外的服务创建（WMI 或 systemd --user）。
 * 会话内启动只作为本机、且没有上述机制时的退路；SSH 会话里启动失败则直接报错，避免断开连接时停服。
 */

import { spawn, spawnSync } from "node:child_process";
import { randomBytes, createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/** 交给会话外宿主的启动参数。路径都来自当前管理进程已经解析好的运行时。 */
export interface DaemonHostSpec {
  /** Node 可执行文件绝对路径 */
  node: string;
  /** 守护进程入口（launcher 或 sfmc 主文件） */
  entry: string;
  /** 实例根目录，同时作为工作目录 */
  root: string;
  /** 守护进程标准输出和标准错误追加到这个文件 */
  logPath: string;
  /** 可选的 pnpm 入口，供之后的维护任务使用 */
  pnpm?: string;
}

/** 当前进程是否由 OpenSSH 拉起。这种会话结束时，里面的进程会被一起回收。 */
function insideSshSession(): boolean {
  return Boolean(process.env.SSH_CONNECTION || process.env.SSH_CLIENT);
}

function currentUser(): string {
  if (process.env.USER) return process.env.USER;
  if (process.env.LOGNAME) return process.env.LOGNAME;
  try { return os.userInfo().username; } catch { return ""; }
}

function shellQuote(text: string): string {
  return `'${text.replace(/'/g, `'\\''`)}'`;
}

function psLiteral(text: string): string {
  return `'${text.replace(/'/g, "''")}'`;
}

/** 从当前管理进程带上用户环境，不带 SSH_CONNECTION，避免守护进程把自己当成这次登录。 */
function carriedEnv(spec: DaemonHostSpec, keys: readonly string[]): Record<string, string> {
  const env: Record<string, string> = {
    SFMC_ROOT: spec.root,
    SFMC_NODE_BINARY: spec.node,
    SFMC_DAEMON_ENTRY: spec.entry,
  };
  if (spec.pnpm) env.SFMC_PNPM_ENTRY = spec.pnpm;
  for (const key of keys) {
    const value = process.env[key];
    if (value) env[key] = value;
  }
  return env;
}

function failureText(result: ReturnType<typeof spawnSync>): string {
  const detail = `${result.stderr || ""}${result.stdout || ""}${result.error?.message || ""}`.trim();
  return detail.slice(-500);
}

/**
 * 本机退路：父进程退出后子进程还能留下。
 * 使用场景：没有 SSH 会话，且 WMI / systemd 用户服务不可用。SSH 里不走这里。
 */
function launchDetached(spec: DaemonHostSpec): void {
  const logFd = fs.openSync(spec.logPath, "a");
  const child = spawn(spec.node, [spec.entry, "--daemon"], {
    detached: true,
    windowsHide: true,
    stdio: ["ignore", logFd, logFd],
    cwd: spec.root,
    env: { ...process.env, ...carriedEnv(spec, []) },
  });
  child.unref();
  try { fs.closeSync(logFd); } catch { /* 日志句柄已交给子进程 */ }
}

/**
 * 由 WMI 创建进程，使守护进程不属于 OpenSSH 的作业对象。
 * 返回 null 表示已经启动；返回字符串是失败原因。
 */
function launchWindowsOutsideSession(spec: DaemonHostSpec): string | null {
  const env = carriedEnv(spec, ["PATH", "PATHEXT", "SystemRoot", "USERNAME", "USERPROFILE", "APPDATA", "LOCALAPPDATA", "TEMP", "TMP"]);
  const assignments = Object.entries(env).map(([key, value]) => `$env:${key} = ${psLiteral(value)}`);
  const log = psLiteral(spec.logPath);
  // 事件回调跑在别的线程，用脚本作用域保住日志写入器。入口参数用字符码拼引号，避免转义把路径截断。
  const script = [
    "$ErrorActionPreference = 'Stop'",
    `$env:SFMC_DAEMON_LOG = ${log}`,
    ...assignments,
    "New-Item -ItemType Directory -Force -Path (Split-Path -Parent $env:SFMC_DAEMON_LOG) | Out-Null",
    "Set-Location -LiteralPath $env:SFMC_ROOT",
    // StreamWriter(path, append) 默认 FileShare.Read，会挡住下一次平台校验里的追加打开。
    "$mode = [System.IO.FileMode]::Append",
    "$access = [System.IO.FileAccess]::Write",
    "$share = [System.IO.FileShare]::ReadWrite",
    "$stream = New-Object System.IO.FileStream($env:SFMC_DAEMON_LOG, $mode, $access, $share)",
    "$inner = New-Object System.IO.StreamWriter($stream)",
    "$inner.AutoFlush = $true",
    "$script:writer = [System.IO.TextWriter]::Synchronized($inner)",
    "Remove-Item Env:SFMC_DAEMON_LOG",
    "$psi = New-Object System.Diagnostics.ProcessStartInfo",
    "$psi.FileName = $env:SFMC_NODE_BINARY",
    "$psi.Arguments = ([char]34) + $env:SFMC_DAEMON_ENTRY + ([char]34) + ' --daemon'",
    "$psi.WorkingDirectory = $env:SFMC_ROOT",
    "$psi.UseShellExecute = $false",
    "$psi.CreateNoWindow = $true",
    "$psi.RedirectStandardOutput = $true",
    "$psi.RedirectStandardError = $true",
    "$proc = New-Object System.Diagnostics.Process",
    "$proc.StartInfo = $psi",
    "$onLine = { param($sender, $lineEvent) if ($null -ne $lineEvent.Data) { $script:writer.WriteLine($lineEvent.Data) } }",
    "$proc.add_OutputDataReceived($onLine)",
    "$proc.add_ErrorDataReceived({ param($sender, $lineEvent) if ($null -ne $lineEvent.Data) { $script:writer.WriteLine($lineEvent.Data) } })",
    "[void]$proc.Start()",
    "$proc.BeginOutputReadLine()",
    "$proc.BeginErrorReadLine()",
    "try { $proc.WaitForExit() } finally { if ($script:writer) { $script:writer.Dispose() } }",
  ];
  const commandLine = `powershell.exe -NoLogo -NoProfile -NonInteractive -EncodedCommand ${Buffer.from(script.join("\n"), "utf16le").toString("base64")}`;
  const run = (hide: boolean) => {
    const startup = hide
      ? "$startup = New-CimInstance -ClassName Win32_ProcessStartup -ClientOnly -Property @{ ShowWindow = 0 }\n"
      : "";
    const invoke = [
      "$ErrorActionPreference = 'Stop'",
      startup.trimEnd(),
      `$result = Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{ CommandLine = ${psLiteral(commandLine)}; CurrentDirectory = ${psLiteral(spec.root)}${hide ? "; ProcessStartupInformation = $startup" : ""} }`,
      "if ($result.ReturnValue -ne 0) { Write-Error \"Win32_Process.Create $($result.ReturnValue)\"; exit 1 }",
    ].filter(Boolean).join("\n");
    return spawnSync("powershell.exe", ["-NoLogo", "-NoProfile", "-NonInteractive", "-EncodedCommand", Buffer.from(invoke, "utf16le").toString("base64")], {
      encoding: "utf8",
      timeout: 30_000,
      windowsHide: true,
    });
  };
  const hidden = run(true);
  if (hidden.status === 0) return null;
  const visible = run(false);
  if (visible.status === 0) return null;
  return failureText(visible) || failureText(hidden) || "Win32_Process.Create 失败";
}

function userBusEnv(): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env, SYSTEMD_ASK_PASSWORD: "0" };
  const uid = process.getuid?.();
  if (uid !== undefined && !env.XDG_RUNTIME_DIR) env.XDG_RUNTIME_DIR = `/run/user/${uid}`;
  if (env.XDG_RUNTIME_DIR && !env.DBUS_SESSION_BUS_ADDRESS && fs.existsSync(`${env.XDG_RUNTIME_DIR}/bus`)) {
    env.DBUS_SESSION_BUS_ADDRESS = `unix:path=${env.XDG_RUNTIME_DIR}/bus`;
  }
  return env;
}

/** 写成可执行脚本，交给 systemd --user。脚本里带上启动当时的用户环境。 */
function writePosixHost(spec: DaemonHostSpec): string {
  const file = path.join(spec.root, ".sfmc", "daemon-host.sh");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const exports = Object.entries(carriedEnv(spec, ["PATH", "HOME", "USER", "LANG", "LC_ALL", "TMPDIR"]))
    .map(([key, value]) => `export ${key}=${shellQuote(value)}`);
  const body = [
    "#!/bin/sh",
    "set -eu",
    `cd ${shellQuote(spec.root)}`,
    ...exports,
    `exec ${shellQuote(spec.node)} ${shellQuote(spec.entry)} --daemon >> ${shellQuote(spec.logPath)} 2>&1`,
    "",
  ].join("\n");
  fs.writeFileSync(file, body, { encoding: "utf8", mode: 0o700 });
  fs.chmodSync(file, 0o700);
  return file;
}

/**
 * 启用 linger 后，用 systemd 用户服务启动。用户服务不属于这次 SSH 会话，登出不会把它停掉。
 * 返回 null 表示已经启动。
 */
function launchSystemdUser(spec: DaemonHostSpec): string | null {
  const user = currentUser();
  if (!user) return "无法确定当前用户，不能放到 systemd 用户服务里";
  const ask = { encoding: "utf8" as const, timeout: 15_000, env: userBusEnv() };
  const enable = spawnSync("loginctl", ["enable-linger", user], ask);
  const show = spawnSync("loginctl", ["show-user", user, "-p", "Linger", "--value"], ask);
  if (show.stdout?.trim() !== "yes") {
    const detail = failureText(enable);
    return `用户 ${user} 没有 linger，登出时系统会结束本次登录中的进程。请先执行 loginctl enable-linger ${user}，或安装开机服务。${detail ? ` ${detail}` : ""}`;
  }
  const script = writePosixHost(spec);
  const unit = `sfmc-${createHash("sha256").update(spec.root).digest("hex").slice(0, 8)}-${randomBytes(3).toString("hex")}`;
  const result = spawnSync("systemd-run", ["--user", "--collect", `--unit=${unit}`, script], {
    encoding: "utf8",
    timeout: 20_000,
    env: userBusEnv(),
  });
  if (result.status === 0) return null;
  return failureText(result) || "systemd-run --user 失败";
}

/**
 * 启动守护进程，并尽量让它活在当前登录会话之外。
 * 使用场景：管理连接第一次发现没有守护进程时调用。已有守护进程不会走到这里。
 */
export function launchDaemonHost(spec: DaemonHostSpec): void {
  fs.mkdirSync(path.dirname(spec.logPath), { recursive: true });
  if (process.platform === "win32") {
    const failure = launchWindowsOutsideSession(spec);
    if (!failure) return;
    if (insideSshSession()) throw new Error(`无法在 SSH 会话之外启动守护进程，已取消启动，避免断开连接时停服。${failure}`);
    launchDetached(spec);
    return;
  }
  if (fs.existsSync("/run/systemd/system")) {
    const failure = launchSystemdUser(spec);
    if (!failure) return;
    if (insideSshSession()) throw new Error(`无法在 SSH 会话之外启动守护进程，已取消启动，避免断开连接时停服。${failure}`);
  }
  launchDetached(spec);
}
