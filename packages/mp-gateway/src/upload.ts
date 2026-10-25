/**
 * upload.ts — 世界包上传到实例收件箱
 *
 * 使用场景：小程序选好 .mcpack / .mcaddon / .zip 后以 `PUT .../packs/inbox?name=<原文件名>` 上传原始字节，
 * 网关写入 `<root>/packs/_desktop-inbox/`，返回收件箱文件名；之后小程序再走 packs.import 管理方法导入。
 * 收件箱目录与文件名规则和桌面端 Session.uploadPack 相同：时间戳前缀 + 清洗后的原名，
 * 最终名称满足 CLI 的 identifier 校验（字母数字开头，仅含字母数字 _ . -，不超过 128 字符，不含 ".."）。
 */
import { randomBytes } from "node:crypto";
import fs from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { Transform } from "node:stream";
import type { GatewayConfig } from "./config.js";

/** 可导入的世界包后缀 */
const PACK_FILE = /\.(mcpack|mcaddon|zip)$/i;
/** CLI identifier 规则，导入时会再次校验 */
const IDENTIFIER = /^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,127}$/;

/** 收件箱目录（与 CLI pack-import.ts 读取的位置一致） */
export function inboxDirectory(root: string): string {
  return path.join(root, "packs", "_desktop-inbox");
}

/**
 * 生成收件箱文件名。超长时保留文件名末尾，确保后缀不被截掉。
 * 返回 null 表示原文件名无法得到合法名称（例如后缀不是世界包）。
 */
export function inboxFilename(original: string, stamp: number): string | null {
  const base = original.split(/[\\/]/).at(-1) ?? "";
  const safe = base.replace(/[^a-zA-Z0-9_.-]/g, "_").replace(/\.{2,}/g, ".");
  if (!PACK_FILE.test(safe)) return null;
  const prefix = `${stamp}-`;
  const room = 128 - prefix.length;
  const name = prefix + (safe.length > room ? safe.slice(safe.length - room) : safe);
  return IDENTIFIER.test(name) && !name.includes("..") ? name : null;
}

/** 以 JSON 结束响应 */
export function sendJson(response: ServerResponse, status: number, body: unknown): void {
  const text = JSON.stringify(body);
  response.writeHead(status, { "content-type": "application/json; charset=utf-8", "content-length": Buffer.byteLength(text) });
  response.end(text);
}

/**
 * 接收一次上传。调用方已完成鉴权。
 * 先写入同目录的临时文件，完整收到后再改名，避免导入任务读到半个文件。
 */
export async function receivePack(request: IncomingMessage, response: ServerResponse, url: URL, config: GatewayConfig): Promise<void> {
  const filename = inboxFilename(url.searchParams.get("name") ?? "", Date.now());
  if (!filename) {
    sendJson(response, 415, { error: "只支持 .mcpack、.mcaddon 或 .zip" });
    return;
  }
  const declared = Number(request.headers["content-length"]);
  if (Number.isFinite(declared) && declared > config.maxUploadBytes) {
    sendJson(response, 413, { error: "文件超过网关上传上限" });
    return;
  }
  const directory = inboxDirectory(config.root);
  fs.mkdirSync(directory, { recursive: true });
  const temp = path.join(directory, `.upload-${randomBytes(6).toString("hex")}`);
  let received = 0;
  const limiter = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      received += chunk.length;
      if (received > config.maxUploadBytes) callback(Object.assign(new Error("文件超过网关上传上限"), { status: 413 }));
      else callback(null, chunk);
    },
  });
  try {
    await pipeline(request, limiter, fs.createWriteStream(temp, { mode: 0o600 }));
    if (received === 0) throw Object.assign(new Error("上传内容为空"), { status: 400 });
    fs.renameSync(temp, path.join(directory, filename));
    sendJson(response, 200, { filename, size: received });
  } catch (error) {
    fs.rmSync(temp, { force: true });
    const status = (error as { status?: number }).status ?? 500;
    if (!response.headersSent) sendJson(response, status, { error: error instanceof Error ? error.message : String(error) });
    else response.destroy();
  }
}
