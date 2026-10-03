import fs from "node:fs";
import path from "node:path";
import net from "node:net";
import dgram from "node:dgram";
import { ROOT } from "../runtime.js";
export function deploymentPort(value: unknown, fallback: number) {
  const port = value === undefined ? fallback : Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("端口必须为 1 到 65535 的整数");
  return port;
}
export async function deploymentPreflight(ports: { db: number; bds: number; bds6: number }) {
  if (path.resolve(ROOT) === path.parse(ROOT).root) throw new Error("不能在磁盘根目录创建部署");
  for (const file of ["BDS/bedrock_server.exe", "BDS/bedrock_server", "data/sfmc_data.db"]) if (fs.existsSync(path.join(ROOT, file))) throw new Error("已有 BDS 或数据库，请接入现有部署，不覆盖数据");
  const space = fs.statfsSync(ROOT);
  if (space.bavail * space.bsize < 1024 ** 3) throw new Error("可用空间不足 1 GiB，无法准备运行时、BDS 和维护备份");
  await new Promise<void>((resolve, reject) => {
    const server = net.createServer(); server.once("error", error => reject(new Error(`DB 端口 ${ports.db} 不可用: ${error.message}`)));
    server.listen(ports.db, "0.0.0.0", () => server.close(error => error ? reject(error) : resolve()));
  });
  for (const [port, type, address] of [[ports.bds, "udp4", "0.0.0.0"], [ports.bds6, "udp6", "::"]] as const) {
    await new Promise<void>((resolve, reject) => {
      const socket = dgram.createSocket(type);
      socket.once("error", error => { socket.close(); reject(new Error(`BDS 端口 ${port} 不可用: ${error.message}`)); });
      socket.bind(port, address, () => socket.close(() => resolve()));
    });
  }
}
