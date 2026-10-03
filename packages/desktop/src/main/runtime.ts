import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { app } from "electron";

export function payload() { return app.isPackaged ? path.join(process.resourcesPath, "payload") : path.join(app.getAppPath(), "payload"); }
export function releaseManifest(): { platformVersion: string; windowsCodeSigned?: boolean; node: { version: string }; pnpm: string; materials: { name: string; sha256: string }[] } {
  return JSON.parse(fs.readFileSync(path.join(payload(), "release-manifest.json"), "utf8"));
}
export function verifyMaterial(name: string) {
  const material = releaseManifest().materials.find(row => row.name === name);
  const file = path.join(payload(), name);
  if (!material || createHash("sha256").update(fs.readFileSync(file)).digest("hex") !== material.sha256) throw new Error(`发行材料校验失败: ${name}`);
  return file;
}
export const launcherSource = "import fs from 'node:fs'; import path from 'node:path'; import {pathToFileURL,fileURLToPath} from 'node:url'; const base=path.dirname(fileURLToPath(import.meta.url)); const active=JSON.parse(fs.readFileSync(path.join(base,'active.json'),'utf8')); process.env.SFMC_DAEMON_ENTRY=fileURLToPath(import.meta.url); process.env.SFMC_NODE_BINARY=process.execPath; if(active.pnpm) process.env.SFMC_PNPM_ENTRY=active.pnpm; await import(pathToFileURL(active.entry).href);\n";
export async function checkedDownload(url: string, destination: string, expected?: string) {
  const response = await fetch(url, { signal: AbortSignal.timeout(120_000) });
  if (!response.ok) throw new Error(`下载失败 (${response.status})`);
  const data = Buffer.from(await response.arrayBuffer());
  if (expected && createHash("sha256").update(data).digest("hex") !== expected) throw new Error("下载内容校验失败");
  fs.mkdirSync(path.dirname(destination), { recursive: true }); const temp = destination + ".tmp"; fs.writeFileSync(temp, data); fs.renameSync(temp, destination);
}
export function exec(command: string, args: string[], cwd: string): Promise<void> {
  return new Promise((resolve, reject) => { const child = spawn(command, args, { cwd, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] }); let output = ""; child.stderr.on("data", chunk => { output = (output + String(chunk)).slice(-4000); }); child.on("error", reject); child.on("close", code => code === 0 ? resolve() : reject(new Error(`准备运行时失败 (${code}): ${output}`))); });
}
export async function ensureLocalRuntime(root: string) {
  if (!path.isAbsolute(root)) throw new Error("本机部署目录必须为绝对路径");
  fs.mkdirSync(root, { recursive: true });
  if (!app.isPackaged && process.env.SFMC_DESKTOP_DEV_NODE) {
    const entry = path.resolve(app.getAppPath(), "../meta/bin/sfmc.mjs");
    return { node: process.env.SFMC_DESKTOP_DEV_NODE, entry, pnpm: process.env.SFMC_PNPM_ENTRY };
  }
  const manifest = releaseManifest();
  const directory = path.join(root, ".sfmc", "runtime");
  const node = path.join(directory, `node-${manifest.node.version}`, "node.exe");
  const bootstrap = path.join(directory, `bootstrap-${manifest.platformVersion}`);
  const bootstrapEntry = path.join(bootstrap, "platform", "node_modules", "@sfmc-bds", "sfmc", "bin", "sfmc.mjs");
  if (!fs.existsSync(node)) await fs.promises.cp(path.join(payload(), "node"), path.dirname(node), { recursive: true, dereference: true });
  if (!fs.existsSync(bootstrapEntry)) { fs.mkdirSync(bootstrap, { recursive: true }); await exec("tar.exe", ["-xf", verifyMaterial("platform.tar"), "-C", bootstrap], root); }
  const pnpm = path.join(directory, `pnpm-${manifest.pnpm}`, "bin", "pnpm.cjs");
  if (!fs.existsSync(pnpm)) await fs.promises.cp(path.join(payload(), "pnpm"), path.dirname(path.dirname(pnpm)), { recursive: true, dereference: true });
  const launcher = path.join(directory, "launcher.mjs");
  const activeFile = path.join(directory, "active.json");
  if (!fs.existsSync(activeFile)) fs.writeFileSync(activeFile, JSON.stringify({ entry: bootstrapEntry, version: manifest.platformVersion, pnpm }));
  if (!fs.existsSync(launcher)) fs.writeFileSync(launcher, launcherSource);
  const wrapper = path.join(directory, "WinSW-x64.exe");
  if (!fs.existsSync(wrapper)) await fs.promises.copyFile(verifyMaterial("WinSW-x64.exe"), wrapper);
  const entry = launcher;
  return { node, entry, pnpm };
}
