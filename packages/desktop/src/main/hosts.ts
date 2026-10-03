import fs from "node:fs";
import path from "node:path";
import { app } from "electron";
const filename = () => path.join(app.getPath("userData"), "known-hosts.json");
export function trustedHosts(): Record<string, string> {
  if (!fs.existsSync(filename())) return {};
  const values = JSON.parse(fs.readFileSync(filename(), "utf8")) as Record<string, unknown>;
  if (!values || typeof values !== "object" || Array.isArray(values) || Object.values(values).some(value => typeof value !== "string" || !/^[a-f0-9]{64}$/.test(value))) throw new Error("主机指纹记录损坏，请先核实并恢复");
  return values as Record<string, string>;
}
export function trustHost(key: string, fingerprint: string, expected?: string) {
  const rows = trustedHosts();
  if (rows[key] && rows[key] !== fingerprint && rows[key] !== expected) throw new Error("主机信任记录已变化，请重新连接核对");
  rows[key] = fingerprint;
  fs.mkdirSync(path.dirname(filename()), { recursive: true });
  const temp = filename() + ".tmp"; fs.writeFileSync(temp, JSON.stringify(rows), { mode: 0o600 }); fs.renameSync(temp, filename());
}
