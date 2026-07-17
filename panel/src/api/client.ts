/**
 * api/client.ts — db-server HTTP 客户端
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "..", "..");

function readJson(file: string): Record<string, unknown> {
  try {
    return JSON.parse(fs.readFileSync(path.join(ROOT_DIR, file), "utf8")) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function resolveDbConfig(): { host: string; port: number } {
  const env = process.env;
  const state = readJson("panel-state.json");
  const config = readJson("configs/db_config.json");
  const statePaths = state["paths"] as { dbPort?: number; dbHost?: string } | undefined;
  const value: unknown = env["DB_PORT"] ?? statePaths?.dbPort ?? config["db_port"] ?? 3001;
  const port = Number.parseInt(String(value), 10);
  const hostRaw: unknown = env["DB_HOST"] ?? statePaths?.dbHost ?? config["db_host"] ?? "127.0.0.1";
  const host = String(hostRaw);
  return { host, port: Number.isInteger(port) && port > 0 && port < 65536 ? port : 3001 };
}

export function getDbBaseUrl(): string {
  const { host, port } = resolveDbConfig();
  return `http://${host}:${port}`;
}

export class ApiError extends Error {
  readonly status: number;
  readonly detail: unknown;
  readonly code: string;
  constructor(opts: { status: number; code: string; detail: unknown; message: string }) {
    super(opts.message);
    this.status = opts.status;
    this.code = opts.code;
    this.detail = opts.detail;
  }
}

export async function requestJson<T>(pathname: string, options: RequestInit & { timeout?: number } = {}): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeout ?? 5000);
  try {
    const res = await fetch(`${getDbBaseUrl()}${pathname}`, {
      ...options,
      signal: controller.signal,
      headers: { ...(options.body ? { "Content-Type": "application/json" } : {}), ...(options.headers ?? {}) },
    });
    const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      const code = String(body["error"] ?? `HTTP ${res.status}`);
      throw new ApiError({ status: res.status, code, detail: body, message: code });
    }
    return body as T;
  } finally {
    clearTimeout(timer);
  }
}

export const getJson = <T>(pathname: string, options?: RequestInit & { timeout?: number }): Promise<T> =>
  requestJson<T>(pathname, options);

export const postJson = <T>(pathname: string, payload?: unknown, options: RequestInit & { timeout?: number } = {}): Promise<T> =>
  requestJson<T>(pathname, { ...options, method: "POST", body: payload !== undefined ? JSON.stringify(payload) : "{}" });
