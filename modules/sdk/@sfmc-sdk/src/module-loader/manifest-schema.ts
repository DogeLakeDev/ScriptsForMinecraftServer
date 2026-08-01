/**
 * 模块 manifest schema — v2 + v3 语义字段。
 *
 * v2 schema 是当前所有已发布模块的契约（详见 schemas/sapi-manifest.v2.schema.json）。
 * v3 在 v2 之上新增 `semantic` 块，全部可选；旧模块不需要改一行代码即可运行。
 *
 * 这里只描述「JS 类型契约」；运行时校验见 manifest.ts。
 */

/** v2 manifest 的最小骨架（与 sapi-manifest.v2.schema.json 对齐）。 */
export type ManifestV2 = {
  schemaVersion: 2;
  id: string;
  name: string;
  type: "core" | "feature";
  configKey: string;
  requires: string[];
  permissions: string[];
  services?: {
    provides?: ServiceEntry[];
    requires?: ServiceEntry[];
  } | undefined;
  notes?: string | undefined;
};

/** services.provides / services.requires 单条。 */
export type ServiceEntry = {
  name: string;
  input?: ServiceIO;
  output?: ServiceIO;
};

/** service io 的最小骨架：JSON Schema 风格的轻描述。 */
export type ServiceIO = {
  type?: "object" | "array" | "string" | "number" | "boolean" | "null";
  properties?: Record<string, unknown>;
  required?: string[];
};

/** 公共事件契约：emits / listens 的路径名。 */
export type ManifestV3Events = {
  /** 模块主动 emit 的自定义事件名（不含 BDS 原生路径；自定义路径通常约定为 `module:<id>:<event>`）。 */
  emits?: string[];
  /** 模块监听的事件路径（包含 BDS 原生 + 自定义）。 */
  listens?: string[];
};

/** 单条 DB 表声明。 */
export type ManifestV3DbTable = {
  name: string;
  /** 列名提示（仅文档性质；运行时不强校验 DB schema）。 */
  columns?: string[];
};

/** 模块对外 API 单条声明。 */
export type ManifestV3PublicApi = {
  /** symbol 名（短名如 "spend"，或带命名空间如 "Player.spend"）。 */
  symbol: string;
  /** 用途描述（短句）。 */
  description?: string;
  /** 参数签名（仅文档性质，不强制运行时校验）。 */
  params?: Array<{
    name: string;
    type: string;
    required?: boolean;
    description?: string;
  }>;
  /** 返回值类型描述。 */
  returns?: { type: string; description?: string };
};

/**
 * v3 语义字段——沙箱读模块「在做什么」的依据。
 * 全部可选；缺失表示 v2 模块（自动从 v2 迁移默认填充）。
 */
export type ManifestV3Semantic = {
  /** 本模块读取的配置键（支持前缀如 `"economy.*"`、精确如 `"land.price"`）。 */
  configKeys?: string[];
  /** 依赖的其他模块 id（启动顺依、UI 提示「请先启用 X」）。 */
  dependsOn?: string[];
  /** 模块 emit/listen 的事件契约。 */
  events?: ManifestV3Events;
  /** DB 表（表名 + 列提示）。 */
  dbTables?: ManifestV3DbTable[];
  /** 模块对外 API（供其他模块 import 使用）。 */
  publicApi?: ManifestV3PublicApi[];
};

/**
 * v3 manifest = v2 + 可选 semantic。
 * 关键兼容点：
 *   - `schemaVersion` 在 v3 时必须为 `3`；
 *   - 其余 v2 字段全部沿用 v2 校验；
 *   - `semantic` 全部可选：不写也能 boot。
 */
export type ManifestV3 = Omit<ManifestV2, "schemaVersion"> & {
  schemaVersion: 3;
  semantic?: ManifestV3Semantic;
};

/** 任意 v2 / v3 manifest。 */
export type AnyManifest = ManifestV2 | ManifestV3;

/** 校验结果。 */
export type ValidationResult<T> =
  | { ok: true; manifest: T }
  | { ok: false; errors: string[] };
