/**
 * module-auth.ts — 模块身份的 HMAC token 派生与校验
 *
 * 两套并存:
 *   - `env.AUTH_TOKEN` (config db_config.json http_auth):sfmc 管控 / 平台内部用
 *   - `moduleTokens[moduleId]`:db-server 给每个 enabled 模块在启动时派生,
 *     写到 data/module-tokens.json,SAPI host-bootstrap 启动时读,按
 *     `setDbModuleContext(moduleId, token)` 注入。
 *
 * 派生公式:
 *   module_token = HMAC-SHA256(auth_secret, "sfmc-module:" + moduleId).hex
 *
 * auth_secret 优先级:
 *   1. env.AUTH_TOKEN
 *   2. 启动时随机生成(无 AUTH_TOKEN 时),写到 data/module-tokens.json,
 *      只警告一次(每次重启模块 token 都变,SAPI host 必须重读文件)
 *
 * 校验:
 *   - HTTP `Authorization: Bearer <module_token>` 头
 *   - Query `?moduleId=<id>`
 *   - 两都匹配 = 调用方身份
 *   - 校验调用方 moduleId 在 enabled 列表(否则 403)
 */

import { createHmac, randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { log } from "./lib/log.js";

export interface ModuleAuthMap {
  /** moduleId → hex token */
  tokens: Record<string, string>;
  /** 用于派生 token 的 secret (env.AUTH_TOKEN 或本次启动随机生成) */
  secret: string;
}

const IDENT = /^[A-Za-z0-9_\-]+$/;

function safeId(id: string): string {
  if (!IDENT.test(id)) throw new Error(`[auth] invalid module id: ${id}`);
  return id;
}

export function deriveToken(moduleId: string, secret: string): string {
  return createHmac("sha256", secret).update(`sfmc-module:${safeId(moduleId)}`).digest("hex");
}

/**
 * 启动时调用一次:
 *   - 把 env.AUTH_TOKEN 当 secret
 *   - 给每个 enabled moduleId 派生 token
 *   - 写 data/module-tokens.json (SAPI host-bootstrap 读)
 *   - 控制台打印摘要(env var SFMC_LOG_MODULE_TOKEN=1 时打完整)
 */
export function buildModuleAuth(opts: {
  projectRoot: string;
  envAuthToken: string;
  enabledModuleIds: string[];
}): ModuleAuthMap {
  const secret = opts.envAuthToken || randomBytes(32).toString("hex");
  const tokens: Record<string, string> = {};
  for (const id of opts.enabledModuleIds) {
    tokens[id] = deriveToken(id, secret);
  }

  const outDir = join(opts.projectRoot, "data");
  mkdirSync(outDir, { recursive: true });
  const outFile = join(outDir, "module-tokens.json");
  writeFileSync(
    outFile,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        secretGenerated: !opts.envAuthToken,
        tokens,
      },
      null,
      2
    ) + "\n",
    "utf8"
  );

  log.success(
    `[auth] 已为 ${opts.enabledModuleIds.length} 个模块派生 HMAC token,写入 ${outFile}`
  );
  if (!opts.envAuthToken) {
    log.warn(
      "[auth] 未配置 env.AUTH_TOKEN(冲突 config http_auth),本次启动使用了随机 secret;"
        + " 重启后 token 会变,host-bootstrap 必须每次重新读 module-tokens.json"
    );
  }
  if (process.env.SFMC_LOG_MODULE_TOKEN === "1") {
    log.info("[auth] module tokens (SFMC_LOG_MODULE_TOKEN=1):");
    for (const [id, t] of Object.entries(tokens)) {
      console.log(`  ${id} = ${t}`);
    }
  } else {
    const lines = Object.entries(tokens)
      .map(([id, t]) => `  ${id} = ${t.slice(0, 6)}…${t.slice(-4)}`)
      .join("\n");
    log.info(`[auth] token 摘要:\n${lines}`);
  }

  return { tokens, secret };
}

export function loadModuleAuth(projectRoot: string): ModuleAuthMap | null {
  const p = join(projectRoot, "data", "module-tokens.json");
  if (!existsSync(p)) return null;
  try {
    const raw = readFileSync(p, "utf8");
    const parsed = JSON.parse(raw) as { tokens?: Record<string, string>; secret?: string };
    if (!parsed.tokens || !parsed.secret) return null;
    return { tokens: parsed.tokens, secret: parsed.secret };
  } catch {
    return null;
  }
}

/**
 * 校验请求方身份:
 *   - Bearer 头 / X-Module-Token 二选一
 *   - ?moduleId=<id> 必须存在
 *   - 模块必须在 enabledModuleIds 集合中
 *   - token 必须 = deriveToken(moduleId, secret)
 * 返回模块 ID 或 null。
 */
export function verifyModuleAuth(opts: {
  headers: NodeJS.Dict<string | string[]>;
  params: URLSearchParams;
  auth: ModuleAuthMap;
  enabledModuleIds: Set<string>;
}): string | null {
  const moduleId = opts.params.get("moduleId") || "";
  if (!moduleId || !opts.enabledModuleIds.has(moduleId)) return null;

  let provided = "";
  const auth = opts.headers["authorization"];
  const token = opts.headers["x-module-token"];
  if (typeof auth === "string" && auth.startsWith("Bearer ")) {
    provided = auth.slice(7);
  } else if (typeof token === "string") {
    provided = token;
  }
  if (!provided) return null;

  const expected = opts.auth.tokens[moduleId];
  if (!expected) return null;
  // constant-time 比较
  if (provided.length !== expected.length) return null;
  let diff = 0;
  for (let i = 0; i < provided.length; i++) {
    diff |= provided.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0 ? moduleId : null;
}
