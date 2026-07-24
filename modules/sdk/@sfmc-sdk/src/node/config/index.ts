import fs from "node:fs";
import path from "node:path";

export interface BdsUpdaterConfig {
  bds_path?: string;
  backup_dir?: string;
  channel?: "release" | "preview" | string;
  auto_restart?: boolean;
  auto_check?: boolean;
  crash_restart?: boolean;
  crash_restart_delay?: number;
  qq_notify?: boolean;
  qq_config?: string;
  preserve?: string[];

  // 高级版本源
  version_mode?: "bedrock-oss" | "endstone";
  version_versions?: string;
  version_versions_mirror?: string;
  version_details?: string;
  version_details_mirror?: string;
  download_mirror?: string;
  cdn_root?: string;
  download_timeout?: number;

  // 兼容版本（升级前白名单）
  compatible_versions?: string[];
}

export interface QQBridgeConfig {
  qq_enabled?: boolean;
  qq_ws_port?: number;
  qq_group_id?: string;
  bridge_channel_id?: string;
  db_host?: string;
  db_port?: number;
  mctoqq_prefix?: string;
  llbot_enabled?: boolean;
  llbot_path?: string;
  llbot_cwd?: string;
  llbot_host?: string;
  llbot_port?: number;
  llbot_token?: string;
  llbot_http?: string;
  [key: string]: unknown;
}

export interface DBConfig {
  db_port?: number;
  dbDir?: string;
  modulesDir?: string;
  http_auth?: string;
  [key: string]: unknown;
}

export interface PermissionsConfig {
  permissions?: Array<{ player_name?: string; level?: number; [key: string]: unknown }>;
  [key: string]: unknown;
}

export interface RuntimeConfig {
  runtime_root?: string;
  initialized_at?: string;
  [key: string]: unknown;
}

export interface RemoteConfig {
  enabled?: boolean;
  controller_url?: string;
  agent_id?: string;
  agent_secret?: string;
  [key: string]: unknown;
}

export interface SettingsConfig {
  [key: string]: unknown;
}

export interface AreasConfig {
  [key: string]: unknown;
}

export interface BannedItemsConfig {
  [key: string]: unknown;
}

export interface CleanConfig {
  item_max?: number;
  poll_interval?: number;
  [key: string]: unknown;
}

export interface GridsConfig {
  [key: string]: unknown;
}

export interface PeaceFiltersConfig {
  [key: string]: unknown;
}

export interface QAConfig {
  [key: string]: unknown;
}

export interface LandConfig {
  [key: string]: unknown;
}

export interface ModuleLock {
  version?: number;
  modules?: Record<string, { enabled: boolean; updatedAt: number }>;
}

export interface Catalog {
  modules?: Array<Record<string, unknown>>;
  [key: string]: unknown;
}

export interface TokenStore {
  tokens?: Record<string, string>;
  secret?: string;
  /** ISO 时间戳：最近一次写入 module-tokens.json */
  generatedAt?: string;
  /** secret 是否为本次启动随机生成（未配置 AUTH_TOKEN） */
  secretGenerated?: boolean;
}

/** 与 @sfmc-bds/sdk/schemas/<name>.schema.json 文件名（不含后缀）对齐 */
export type ConfigSchemaId =
  | "db_config"
  | "qq_config"
  | "bds_updater"
  | "permissions"
  | "pack_update"
  | "remote"
  | "pack_sources"
  | "module_catalog";

/**
 * 生成文件内 `$schema` 相对路径（相对 configs/ 或 packs/）。
 * IDE 用；运行时加载器应忽略该键。
 */
export function configSchemaRef(
  schemaId: ConfigSchemaId,
  from: "configs" | "packs" | "modules" = "configs"
): string {
  const rel =
    from === "configs"
      ? "../node_modules/@sfmc-bds/sdk/schemas"
      : from === "packs"
        ? "../node_modules/@sfmc-bds/sdk/schemas"
        : "../node_modules/@sfmc-bds/sdk/schemas";
  return `${rel}/${schemaId}.schema.json`;
}

/** 在对象根写入 `$schema`（不覆盖已有）；数组根勿调用。 */
export function withConfigSchema<T extends Record<string, unknown>>(
  value: T,
  schemaId: ConfigSchemaId,
  from: "configs" | "packs" | "modules" = "configs"
): T & { $schema: string } {
  if (typeof value.$schema === "string" && value.$schema.length > 0) {
    return value as T & { $schema: string };
  }
  return { $schema: configSchemaRef(schemaId, from), ...value };
}

/** 配置元数据键：`$schema` 与 `_` / `_comment*` 前缀，加载时跳过 */
export function isConfigMetaKey(k: string): boolean {
  return k === "$schema" || k.startsWith("_");
}

/** 浅剥离对象上的元数据键（不递归数组元素内的对象以外的深层——调用方可再 strip） */
export function stripConfigMeta<T extends Record<string, unknown>>(obj: T): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (!isConfigMetaKey(k)) out[k] = v;
  }
  return out as T;
}

/** db-server ensure 种子（无 `$schema`；写入前用 withConfigSchema） */
export const DEFAULT_DB_CONFIG: DBConfig = {
  db_port: 3001,
  http_auth: "",
  dbDir: "./data/sfmc_data.db",
  modulesDir: "modules",
};

/** qq-bridge / db-server 共用种子 */
export const DEFAULT_QQ_CONFIG: QQBridgeConfig = {
  qq_ws_port: 3002,
  qq_group_id: "0",
  llbot_enabled: false,
  llbot_path: "",
  llbot_cwd: "",
  llbot_host: "127.0.0.1",
  llbot_port: 3004,
  llbot_token: "",
  bridge_channel_id: "",
  mctoqq_prefix: "[MC]",
};

/** bds-tools ensure 种子 */
export const DEFAULT_BDS_UPDATER_CONFIG: BdsUpdaterConfig = {
  bds_path: "",
  backup_dir: "",
  channel: "release",
  preserve: ["server.properties", "whitelist.json", "permissions.json", "allowlist.json", "worlds", "config"],
  qq_notify: false,
  qq_config: "../configs/qq_config.json",
  auto_check: true,
  crash_restart: true,
  auto_restart: true,
};

/** permissions.json 根为数组；默认空表 */
export const DEFAULT_PERMISSIONS: Array<{ player_name: string; level: number }> = [];

/** remote.json 骨架（enroll 前） */
export const DEFAULT_REMOTE_CONFIG: RemoteConfig = {
  enabled: false,
  controller_url: "",
  agent_id: "",
  agent_secret: "",
};

/**
 * 仓顶服务读写的所有配置 JSON 文件名。
 * 用字面量 union 防止拼写错误并提供 IDE 补全。
 */
export type ConfigName =
  | "qq_config.json"
  | "db_config.json"
  | "permissions.json"
  | "bds_updater.json"
  | "pack-update.json"
  | "runtime.json"
  | "settings.json"
  | "areas.json"
  | "banned_items.json"
  | "clean.json"
  | "grids.json"
  | "peace_filters.json"
  | "questions.json"
  | "land.json"
  | "remote.json";

/**
 * 模块系统文件(不在 configs/ 下,但同属"项目根 + 仓顶服务管理"的范畴)。
 */
export type ModuleFileName = "catalog.json" | "module-lock.json";

/**
 * 解析项目根目录。
 *
 * 优先级:
 *   1. `process.env.SFMC_ROOT`(由 spawnService 注入到子进程)
 *   2. `fallbackRoot`(各服务自传的 `__dirname` 上溯到 monorepo 根 / 安装根)
 *
 * 所有仓顶服务(db-server / qq-bridge / bds-tools / sfmc)统一调用本函数,
 * 不要再自己写 `resolve(__dirname, "..", "..")`。
 */
export function resolveRuntimeRoot(fallbackRoot: string): string {
  return path.resolve(process.env.SFMC_ROOT || fallbackRoot);
}

/**
 * 把配置 JSON 内的相对路径解析为绝对路径。
 * 绝对路径直接返回;相对路径相对 runtimeRoot 解析。
 */
export function resolveRuntimePath(runtimeRoot: string, configuredPath: string): string {
  return path.isAbsolute(configuredPath) ? configuredPath : path.resolve(runtimeRoot, configuredPath);
}

export function configDir(runtimeRoot: string): string {
  return path.join(runtimeRoot, "configs");
}

export function configPath(runtimeRoot: string, name: ConfigName): string {
  return path.join(configDir(runtimeRoot), name);
}

export function moduleDir(runtimeRoot: string): string {
  return path.join(runtimeRoot, "modules");
}

export function modulePath(dir: string, name: ModuleFileName): string {
  return path.join(dir, name);
}

export function readJson<T>(filePath: string, fallback?: T): T | undefined {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8")) as T;
  } catch {
    if (fallback !== undefined) return fallback;
  }
  return undefined;
}

/**
 * 原子写 JSON:写到临时文件再 rename,避免半写状态。
 * 自动创建父目录。
 */
export function writeJson(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tmp = `${filePath}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(value, null, 2)}\n`, "utf-8");
  fs.renameSync(tmp, filePath);
}

/**
 * 浅合并:读出现有 JSON,与 partial 合并,原子写回。
 * 文件不存在视为 {}。
 */
export function patchJson<T extends object>(filePath: string, partial: Partial<T>): T {
  const existing = (readJson<T>(filePath) ?? ({} as T)) as T;
  const merged = { ...existing, ...partial } as T;
  writeJson(filePath, merged);
  return merged;
}

/**
 * 确保 JSON 文件存在。
 *   - 存在 → 不动,返回现有内容(或 fallback)
 *   - 不存在 → 写入 `seed`(默认 `{}`),返回 seed
 *
 * 设计:仓顶服务启动时调用,代替"由 wizard 创建 json"的老模式。
 * 不应该由 wizard 兜底——wizard 只负责交互式填字段,文件骨架应该是
 * 进程启动时一次性就地创建。
 */
export function ensureJson<T>(filePath: string, seed: T = {} as T): T {
  const existing = readJson<T>(filePath);
  if (existing !== undefined) return existing;
  writeJson(filePath, seed);
  return seed;
}

/**
 * 仓顶 config JSON 的 ensure 便捷版:拼接 configPath + ensureJson。
 */
export function ensureJsonConfig<T>(root: string, name: ConfigName, seed: T = {} as T): T {
  return ensureJson<T>(configPath(root, name), seed);
}