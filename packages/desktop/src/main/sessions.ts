import { Client, type SFTPWrapper, type ClientChannel } from "ssh2";
import { dialog, app } from "electron";
import fs from "node:fs";
import path from "node:path";
import { spawn, type ChildProcess } from "node:child_process";
import { Duplex, Readable, Writable } from "node:stream";
import { ManagementClient } from "@sfmc-bds/management/node";
import type { Credentials, InstanceProfile } from "../shared/api.js";
import { ensureLocalRuntime, payload, checkedDownload, releaseManifest, verifyMaterial, launcherSource } from "./runtime.js";
import { trustedHosts, trustHost } from "./hosts.js";

const shellQuote = (text: string) => "'" + text.replace(/'/g, "'\\''") + "'";
const powershell = (script: string) => "powershell.exe -NoLogo -NoProfile -NonInteractive -EncodedCommand " + Buffer.from(script, "utf16le").toString("base64");
const psValue = (text: string) => `[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${Buffer.from(text).toString("base64")}'))`;
export class Session {
  changedFingerprint?: { key: string; previous: string; current: string };
  client?: ManagementClient;
  ssh?: Client;
  child?: ChildProcess;
  private sftp?: SFTPWrapper;
  constructor(readonly profile: InstanceProfile, private credentials: Credentials, private notify: (message: string) => void) {
    this.credentials = { ...(typeof credentials.password === "string" ? { password: credentials.password } : {}), ...(typeof credentials.passphrase === "string" ? { passphrase: credentials.passphrase } : {}) };
  }
  async connect() {
    if (this.profile.kind === "local") {
      const runtime = await ensureLocalRuntime(this.profile.root);
      const child = spawn(runtime.node, [runtime.entry, "manage", "--stdio"], { cwd: this.profile.root, env: { ...process.env, SFMC_ROOT: this.profile.root, SFMC_NODE_BINARY: runtime.node, SFMC_DAEMON_ENTRY: runtime.entry, ...(runtime.pnpm ? { SFMC_PNPM_ENTRY: runtime.pnpm } : {}) }, windowsHide: true, stdio: "pipe" });
      this.child = child;
      child.on("error", error => this.notify(error.message));
      child.stderr?.on("data", () => {});
      this.client = new ManagementClient(Duplex.fromWeb({ readable: Readable.toWeb(child.stdout!), writable: Writable.toWeb(child.stdin!) }));
    } else {
      await this.connectSsh();
      const runtime = await this.prepareRemote();
      const command = this.profile.os === "windows"
        ? powershell(`$env:SFMC_PNPM_ENTRY=${psValue(runtime.pnpm)}; $env:SFMC_NODE_BINARY=${psValue(runtime.node)}; $env:SFMC_DAEMON_ENTRY=${psValue(runtime.entry)}; & (${psValue(runtime.node)}) (${psValue(runtime.entry)}) manage --stdio`)
        : `SFMC_PNPM_ENTRY=${shellQuote(runtime.pnpm)} SFMC_NODE_BINARY=${shellQuote(runtime.node)} SFMC_DAEMON_ENTRY=${shellQuote(runtime.entry)} ${shellQuote(runtime.node)} ${shellQuote(runtime.entry)} manage --stdio`;
      const stream = await this.execStream(command);
      stream.stderr.on("data", () => {});
      this.client = new ManagementClient(stream);
    }
    this.client.on("disconnected", message => this.notify(`管理连接已断开: ${String(message)}`));
    return this.client.handshake(this.profile.root);
  }
  private async connectSsh() {
    const ssh = new Client(); this.ssh = ssh;
    const profile = this.profile;
    const trusted = trustedHosts();
    await new Promise<void>((resolve, reject) => {
      ssh.once("ready", resolve); ssh.once("error", reject); ssh.on("close", () => this.notify("SSH 连接断开，服务器和后台任务继续运行"));
      ssh.connect({ host: profile.host!, port: profile.port ?? 22, username: profile.username!, readyTimeout: 20_000, keepaliveInterval: 10_000, keepaliveCountMax: 3,
        ...(profile.privateKeyPath ? { privateKey: fs.readFileSync(profile.privateKeyPath) } : {}), ...this.credentials,
        hostHash: "sha256", hostVerifier: (fingerprint: string | Buffer, callback: (valid: boolean) => void): void => {
          const hash = fingerprint.toString();
          const key = `${profile.host}:${profile.port ?? 22}`;
          if (trusted[key]) { if (trusted[key] !== hash) { this.changedFingerprint = { key, previous: trusted[key]!, current: hash }; this.notify("SSH 主机指纹发生变化，连接已阻断；请核实服务器身份"); } callback(trusted[key] === hash); return; }
          void dialog.showMessageBox({ type: "question", title: "确认 SSH 主机身份", message: `首次连接 ${key}`, detail: `SHA256（十六进制）: ${hash}\n请与服务器管理员提供的指纹核对。`, buttons: ["取消", "信任并连接"], defaultId: 0, cancelId: 0 }).then(answer => {
            if (answer.response === 1) trustHost(key, hash);
            callback(answer.response === 1);
          }).catch(() => callback(false));
        } });
    });
    this.sftp = await new Promise<SFTPWrapper>((resolve, reject) => ssh.sftp((error, sftp) => error ? reject(error) : resolve(sftp)));
  }
  private execStream(command: string): Promise<ClientChannel> { return new Promise((resolve, reject) => this.ssh!.exec(command, { pty: false }, (error, stream) => error ? reject(error) : resolve(stream))); }
  private async execRemote(command: string) {
    const stream = await this.execStream(command);
    return new Promise<void>((resolve, reject) => { let errorText = ""; stream.stderr.on("data", chunk => { errorText = (errorText + String(chunk)).slice(-4000); }); stream.on("data", () => {}); stream.on("close", (code: number) => code === 0 ? resolve() : reject(new Error(`远程准备失败 (${code}): ${errorText}`))); });
  }
  private async upload(local: string, remote: string) { await new Promise<void>((resolve, reject) => this.sftp!.fastPut(local, remote.replace(/\\/g, "/"), error => error ? reject(error) : resolve())); }
  private async prepareRemote() {
    const root = this.profile.root;
    const windows = this.profile.os === "windows";
    if (windows ? !/^[A-Za-z]:[\\/]/.test(root) : !root.startsWith("/")) throw new Error("请填写远程系统的绝对部署目录");
    const join = windows ? path.win32.join : path.posix.join;
    const directory = join(root, ".sfmc", "runtime");
    const manifest = releaseManifest();
    const nodeDirectory = join(directory, `node-${manifest.node.version}`);
    const archive = join(directory, "platform.tar");
    const bootstrap = join(directory, `bootstrap-${manifest.platformVersion}`);
    const node = join(nodeDirectory, windows ? "node.exe" : "bin/node");
    const bootstrapEntry = join(bootstrap, "platform", "node_modules", "@sfmc-bds", "sfmc", "bin", "sfmc.mjs");
    const entry = join(directory, "launcher.mjs");
    const pnpm = join(directory, `pnpm-${manifest.pnpm}`, "bin", "pnpm.cjs");
    const materials = verifyMaterial("platform.tar");
    if (!fs.existsSync(materials)) throw new Error("缺少远程部署材料，请先运行桌面打包准备流程");
    this.notify("正在准备远程独立运行时，首次接入可能需要下载");
    await this.execRemote(windows ? powershell(`$ErrorActionPreference='Stop'; New-Item -ItemType Directory -Force (${psValue(directory)}) | Out-Null`) : `mkdir -p -- ${shellQuote(directory)}`);
    const nodeArchive = windows ? `node-v${manifest.node.version}-win-x64.zip` : `node-v${manifest.node.version}-linux-x64.tar.xz`;
    const response = await fetch(`https://nodejs.org/dist/v${manifest.node.version}/SHASUMS256.txt`, { signal: AbortSignal.timeout(20_000) });
    if (!response.ok) throw new Error("无法获取 Node 校验清单");
    const checksum = (await response.text()).split("\n").find(line => line.endsWith(`  ${nodeArchive}`))?.split(/\s+/)[0];
    if (!checksum || !/^[a-f0-9]{64}$/.test(checksum)) throw new Error("缺少固定版本 Node 校验值");
    const nodeUrl = `https://nodejs.org/dist/v${manifest.node.version}/${nodeArchive}`;
    const nodeTarget = join(directory, nodeArchive);
    // 远端自行下载并校验，下载不可用时交给客户端中转。
    const extractNode = windows
      ? `if ((Get-FileHash -LiteralPath (${psValue(nodeTarget)}) -Algorithm SHA256).Hash.ToLower() -ne '${checksum}') { throw 'Node 校验失败' }; Expand-Archive -LiteralPath (${psValue(nodeTarget)}) -DestinationPath (${psValue(directory)}) -Force; if (Test-Path -LiteralPath (${psValue(nodeDirectory)})) { throw '不完整的 Node 目录已存在，请先检查' }; Move-Item -LiteralPath (${psValue(join(directory, `node-v${manifest.node.version}-win-x64`))}) -Destination (${psValue(nodeDirectory)})`
      : `printf '%s  %s\n' ${shellQuote(checksum)} ${shellQuote(nodeTarget)} | sha256sum -c -; mkdir -p ${shellQuote(nodeDirectory)}; tar -xf ${shellQuote(nodeTarget)} -C ${shellQuote(nodeDirectory)} --strip-components=1`;
    if (!await this.remoteExists(node)) {
      try { await this.execRemote(windows ? powershell(`$ErrorActionPreference='Stop'; Invoke-WebRequest '${nodeUrl}' -OutFile (${psValue(nodeTarget)})`) : `curl -fL ${shellQuote(nodeUrl)} -o ${shellQuote(nodeTarget)}`); }
      catch {
        this.notify("远端下载不可用，正在通过客户端中转独立 Node");
        const cached = path.join(app.getPath("temp"), `sfmc-${checksum}-${nodeArchive}`);
        await checkedDownload(nodeUrl, cached, checksum); await this.upload(cached, nodeTarget);
      }
      await this.execRemote(windows ? powershell(`$ErrorActionPreference='Stop'; ${extractNode}`) : `set -eu; ${extractNode}`);
    }
    if (!await this.remoteExists(bootstrapEntry)) {
      await this.upload(materials, archive);
      await this.execRemote(windows
        ? powershell(`$ErrorActionPreference='Stop'; New-Item -ItemType Directory -Force (${psValue(bootstrap)}) | Out-Null; tar -xf (${psValue(archive)}) -C (${psValue(bootstrap)}); if ($LASTEXITCODE -ne 0) { throw '平台解包失败' }`)
        : `set -eu; mkdir -p ${shellQuote(bootstrap)}; tar -xf ${shellQuote(archive)} -C ${shellQuote(bootstrap)}; find ${shellQuote(bootstrap)} -type f -path '*/@esbuild/linux-x64/bin/esbuild' -exec chmod +x '{}' +`);
    }
    const pnpmArchive = path.join(payload(), "pnpm.tar");
    if (!await this.remoteExists(pnpm)) {
      verifyMaterial("pnpm.tar"); await this.upload(pnpmArchive, join(directory, "pnpm.tar"));
      await this.execRemote(windows ? powershell(`$ErrorActionPreference='Stop'; tar -xf (${psValue(join(directory, "pnpm.tar"))}) -C (${psValue(directory)}); if ($LASTEXITCODE -ne 0) { throw 'pnpm 解包失败' }; Move-Item -LiteralPath (${psValue(join(directory, "pnpm"))}) -Destination (${psValue(join(directory, `pnpm-${manifest.pnpm}`))})`) : `set -eu; tar -xf ${shellQuote(join(directory, "pnpm.tar"))} -C ${shellQuote(directory)}; mv -- ${shellQuote(join(directory, "pnpm"))} ${shellQuote(join(directory, `pnpm-${manifest.pnpm}`))}`);
    }
    for (const [name, content] of [["launcher.mjs", launcherSource], ["active.json", JSON.stringify({ entry: bootstrapEntry, version: manifest.platformVersion, pnpm })]]) {
      if (!await this.remoteExists(join(directory, name!))) {
        const temp = path.join(app.getPath("temp"), `sfmc-${this.profile.id}-${name}`);
        fs.writeFileSync(temp, content!); await this.upload(temp, join(directory, name!)); fs.unlinkSync(temp);
      }
    }
    if (windows && !await this.remoteExists(join(directory, "WinSW-x64.exe"))) await this.upload(verifyMaterial("WinSW-x64.exe"), join(directory, "WinSW-x64.exe"));
    return { node, entry, pnpm };
  }
  private async remoteExists(file: string) {
    return new Promise<boolean>((resolve, reject) => this.sftp!.stat(file.replace(/\\/g, "/"), (error, stat) => { if (!error) resolve(stat.isFile()); else if (Number((error as NodeJS.ErrnoException).code) === 2) resolve(false); else reject(error); }));
  }
  async uploadPack(local: string) {
    const filename = `${Date.now()}-${path.basename(local).replace(/[^a-zA-Z0-9_.-]/g, "_")}`;
    const join = this.profile.kind === "ssh" && this.profile.os === "linux" ? path.posix.join : path.win32.join;
    const directory = join(this.profile.root, "packs", "_desktop-inbox");
    if (this.profile.kind === "local") { fs.mkdirSync(directory, { recursive: true }); await fs.promises.copyFile(local, join(directory, filename)); }
    else {
      await this.execRemote(this.profile.os === "windows" ? powershell(`New-Item -ItemType Directory -Force (${psValue(directory)}) | Out-Null`) : `mkdir -p ${shellQuote(directory)}`);
      await this.upload(local, join(directory, filename));
    }
    return { filename };
  }
  /** 只关闭这条管理通道。守护进程在登录会话之外，结束 SSH 或本地 stdio 不会停止服务器进程。 */
  disconnect() { this.client?.disconnect(); this.ssh?.end(); this.child?.stdin?.end(); this.credentials = {}; }
}
