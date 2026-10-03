import { app, safeStorage } from "electron";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { InstanceProfile, Credentials } from "../shared/api.js";

type Stored = InstanceProfile & { encrypted?: string };
const sessionSecrets = new Map<string, Credentials>();
export function rememberSession(id: string, secret?: Credentials) {
  if (!secret) return;
  const value = { ...(typeof secret.password === "string" && secret.password ? { password: secret.password } : {}), ...(typeof secret.passphrase === "string" && secret.passphrase ? { passphrase: secret.passphrase } : {}) };
  if (Object.keys(value).length) sessionSecrets.set(id, value);
}
function filename() { return path.join(app.getPath("userData"), "instances.json"); }
function stored(): Stored[] { try { return JSON.parse(fs.readFileSync(filename(), "utf8")) as Stored[]; } catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return []; throw error; } }
function write(rows: Stored[]) {
  fs.mkdirSync(path.dirname(filename()), { recursive: true });
  const temp = filename() + ".tmp"; fs.writeFileSync(temp, JSON.stringify(rows, null, 2), { mode: 0o600 }); fs.renameSync(temp, filename());
}
export function profiles() { return stored().map(({ encrypted, ...profile }) => ({ ...profile, hasCredential: Boolean(encrypted || sessionSecrets.has(profile.id)) })); }
export function profile(id: string): InstanceProfile { const found = profiles().find(row => row.id === id); if (!found) throw new Error("实例不存在"); return found; }
export function credentials(id: string): Credentials {
  const session = sessionSecrets.get(id); if (session) return { ...session };
  const row = stored().find(row => row.id === id);
  if (!row?.encrypted) return {};
  if (!safeStorage.isEncryptionAvailable()) throw new Error("当前系统无法解密保存的凭据");
  return JSON.parse(safeStorage.decryptString(Buffer.from(row.encrypted, "base64"))) as Credentials;
}
export function saveProfile(input: InstanceProfile, secret: Credentials) {
  if (!input || !["local", "ssh"].includes(input.kind) || typeof input.name !== "string" || !input.name.trim() || typeof input.root !== "string" || !input.root.trim() || /[\r\n\0]/.test(input.root)) throw new Error("实例名称和目录无效");
  if (input.kind === "ssh" && (!input.host || !input.username || !["linux", "windows"].includes(input.os ?? ""))) throw new Error("SSH 连接信息不完整");
  if (input.kind === "ssh" && (typeof input.host !== "string" || typeof input.username !== "string" || /[\r\n\0]/.test(input.host + input.username) || !Number.isInteger(input.port ?? 22) || (input.port ?? 22) < 1 || (input.port ?? 22) > 65535)) throw new Error("SSH 主机、账号或端口无效");
  secret = { ...(typeof secret?.password === "string" ? { password: secret.password } : {}), ...(typeof secret?.passphrase === "string" ? { passphrase: secret.passphrase } : {}) };
  const rows = stored(); const id = input.id || randomUUID();
  const previous = rows.find(row => row.id === id);
  rememberSession(id, secret);
  const row: Stored = { id, name: input.name.trim(), root: input.root.trim(), kind: input.kind, port: input.port || 22, host: input.host ?? "", username: input.username ?? "", os: input.os ?? "linux", privateKeyPath: input.privateKeyPath ?? "", remember: input.remember === true };
  if (row.remember) {
    if (!safeStorage.isEncryptionAvailable()) throw new Error("系统凭据加密不可用，不会保存明文密码");
    row.encrypted = Object.keys(secret).some(key => secret[key as keyof Credentials]) ? safeStorage.encryptString(JSON.stringify(secret)).toString("base64") : previous?.encrypted;
  }
  write([...rows.filter(existing => existing.id !== id), row]); return profiles();
}
export function removeProfile(id: string) { sessionSecrets.delete(id); write(stored().filter(row => row.id !== id)); return profiles(); }
