import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { createHash } from "node:crypto";
import { ROOT } from "../runtime.js";

/** 生成可审阅的管理员安装入口，密码通过系统 Credential API 提交。 */
export function startupPlan() {
  const stable = path.join(ROOT, ".sfmc", "runtime", "launcher.mjs");
  const entry = fs.existsSync(stable) ? stable : process.env.SFMC_DAEMON_ENTRY;
  if (!entry) throw new Error("无法确定守护进程入口");
  const id = createHash("sha256").update(path.resolve(ROOT)).digest("hex").slice(0, 16);
  let account = process.env.USERNAME ?? process.env.USER ?? "";
  try { account = os.userInfo().username; } catch { /* 权限受限宿主仍可生成由管理员填写账号的安装脚本 */ }
  if (process.platform === "win32") {
    const quote = (text: string) => "'" + text.replace(/'/g, "''") + "'";
    const wrapper = path.join(ROOT, ".sfmc", "runtime", `sfmc${id}.exe`);
    const xml = wrapper.replace(/\.exe$/, ".xml");
    const escapeXml = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
    const body = `<service><id>sfmc${id}</id><name>SFMC ${id}</name><executable>${escapeXml(process.execPath)}</executable><startarguments>&quot;${escapeXml(entry)}&quot; --daemon --autostart</startarguments><stopexecutable>${escapeXml(process.execPath)}</stopexecutable><stoparguments>&quot;${escapeXml(entry)}&quot; daemon stop</stoparguments><workingdirectory>${escapeXml(ROOT)}</workingdirectory><env name="SFMC_ROOT" value="${escapeXml(ROOT)}"/><stoptimeout>90sec</stoptimeout><log mode="roll"/></service>`;
    return { filename: "install-sfmc-service.ps1", script: `#Requires -RunAsAdministrator\n$ErrorActionPreference = 'Stop'\n$wrapper = ${quote(wrapper)}\nif (Get-Service -Name ${quote(`sfmc${id}`)} -ErrorAction SilentlyContinue) { throw '系统服务已存在，不重复安装' }\nCopy-Item -LiteralPath ${quote(path.join(ROOT, ".sfmc", "runtime", "WinSW-x64.exe"))} -Destination $wrapper\n${quote(body)} | Set-Content -LiteralPath ${quote(xml)} -Encoding UTF8\n$credential = Get-Credential -UserName ${quote(account)} -Message '输入原 Windows 部署账号；密码只交给系统服务管理器'\n& ${quote(process.execPath)} ${quote(entry)} daemon stop\nif ($LASTEXITCODE -ne 0) { throw '原守护进程停止失败' }\nNew-Service -Name ${quote(`sfmc${id}`)} -BinaryPathName ('"' + $wrapper + '"') -Credential $credential -StartupType Automatic\nStart-Service -Name ${quote(`sfmc${id}`)}\n` };
  }
  const escapeUnit = (text: string) => text.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/%/g, "%%");
  if (!account || /[\r\n\0]/.test(account)) throw new Error("无法确定原部署账号");
  const unit = `[Unit]\nDescription=SFMC ${id}\nAfter=network.target\n[Service]\nType=simple\nUser=${account}\nWorkingDirectory="${escapeUnit(ROOT)}"\nEnvironment="SFMC_ROOT=${escapeUnit(ROOT)}"\nExecStart="${escapeUnit(process.execPath)}" "${escapeUnit(entry)}" --daemon --autostart\nExecStop="${escapeUnit(process.execPath)}" "${escapeUnit(entry)}" daemon stop\nRestart=on-failure\nTimeoutStopSec=90\n[Install]\nWantedBy=multi-user.target\n`;
  const quote = (text: string) => "'" + text.replace(/'/g, "'\\''") + "'";
  return { filename: "install-sfmc-service.sh", script: `#!/bin/sh\nset -eu\n[ "$(id -u)" = 0 ] || { echo '请以管理员运行此一次性安装脚本'; exit 1; }\nunit=/etc/systemd/system/sfmc-${id}.service\n[ ! -e "$unit" ] || { echo '系统服务已存在，不重复安装'; exit 1; }\n${quote(process.execPath)} ${quote(entry)} daemon stop\nprintf '%s' '${Buffer.from(unit).toString("base64")}' | base64 -d > "$unit"\nsystemctl daemon-reload\nsystemctl enable --now sfmc-${id}.service\n` };
}
