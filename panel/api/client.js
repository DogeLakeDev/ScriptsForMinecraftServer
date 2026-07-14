import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "..", "..");

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(path.join(ROOT_DIR, file), "utf8"));
  } catch {
    return {};
  }
}

function resolveDbConfig({ env = process.env, config = {} } = {}) {
  const value = env.DB_PORT || config.db_port || 3001;
  const port = Number.parseInt(value, 10);
  const host = env.DB_HOST || config.db_host || "127.0.0.1";
  return { host, port: Number.isInteger(port) && port > 0 && port < 65536 ? port : 3001 };
}

function getDbPort() {
  const config = readJson("configs/db_config.json");
  return resolveDbConfig({ config }).port;
}

export function getDbBaseUrl() {
  const config = readJson("configs/db_config.json");
  const { host, port } = resolveDbConfig({ config });
  return `http://${host}:${port}`;
}

export async function requestJson(pathname, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeout ?? 5000);
  try {
    const response = await fetch(`${getDbBaseUrl()}${pathname}`, {
      ...options,
      signal: controller.signal,
      headers: { ...(options.body ? { "Content-Type": "application/json" } : {}), ...(options.headers || {}) },
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(body.error || `HTTP ${response.status}`);
      error.status = response.status;
      error.detail = body;
      error.code = body.error;
      throw error;
    }
    return body;
  } finally {
    clearTimeout(timer);
  }
}

export function getJson(pathname, options) {
  return requestJson(pathname, options);
}

export function postJson(pathname, payload, options = {}) {
  return requestJson(pathname, {
    ...options,
    method: "POST",
    body: JSON.stringify(payload ?? {}),
  });
}

export function putJson(pathname, payload, options = {}) {
  return requestJson(pathname, {
    ...options,
    method: "PUT",
    body: JSON.stringify(payload ?? {}),
  });
}

export { getDbPort, resolveDbConfig };
