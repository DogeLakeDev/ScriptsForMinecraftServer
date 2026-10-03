/**
 * config-form.ts — 配置文件的"表单视图"模型
 *
 * 使用场景：配置页"表单"标签。JSON 配置优先按 JSON Schema 生成字段（类型、枚举、范围、说明），
 * 没有 Schema 时按现有值的顶层基础类型推断；server.properties 使用内置的常用字段清单。
 * 所有修改都回写到原文（jsonc-parser modify / 按行替换），保证注释与未知字段原样保留。
 */
import { applyEdits, modify, parse, type ParseError } from "jsonc-parser";

/** 单个表单字段的描述 */
export interface FieldSpec {
  key: string;
  /** 展示名称（缺省用 key） */
  label?: string;
  description?: string;
  kind: "boolean" | "number" | "string" | "enum" | "secret";
  options?: { value: string; label: string }[];
  min?: number;
  max?: number;
  integer?: boolean;
  /** 字段分组（server.properties 使用） */
  group?: string;
}

/** 名称看起来像凭据的字段统一按密码框渲染 */
const SECRET_KEY = /(auth|token|secret|password|passwd|credential)/i;

/** JSON Schema 中顶层属性的最小结构 */
interface SchemaProperty {
  type?: string | string[];
  enum?: unknown[];
  description?: string;
  title?: string;
  minimum?: number;
  maximum?: number;
}

/**
 * 从 JSON Schema 顶层属性生成字段；对象/数组等复杂类型留给源码编辑。
 * 返回 [字段, 被跳过的复杂字段数]。
 */
export function fieldsFromSchema(schema: object): [FieldSpec[], number] {
  const properties = (schema as { properties?: Record<string, SchemaProperty> }).properties ?? {};
  const fields: FieldSpec[] = [];
  let skipped = 0;
  for (const [key, property] of Object.entries(properties)) {
    if (key === "$schema") continue;
    const type = Array.isArray(property.type) ? property.type.find((value) => value !== "null") : property.type;
    const base = { key, ...(property.title ? { label: property.title } : {}), ...(property.description ? { description: property.description } : {}) };
    if (Array.isArray(property.enum) && property.enum.every((value) => typeof value === "string")) {
      fields.push({ ...base, kind: "enum", options: (property.enum as string[]).map((value) => ({ value, label: value })) });
    } else if (type === "boolean") fields.push({ ...base, kind: "boolean" });
    else if (type === "integer" || type === "number") {
      fields.push({ ...base, kind: "number", integer: type === "integer", ...(property.minimum !== undefined ? { min: property.minimum } : {}), ...(property.maximum !== undefined ? { max: property.maximum } : {}) });
    } else if (type === "string") fields.push({ ...base, kind: SECRET_KEY.test(key) ? "secret" : "string" });
    else skipped++;
  }
  return [fields, skipped];
}

/** 没有 Schema 时按现有值推断顶层基础类型字段 */
export function fieldsFromValue(value: unknown): [FieldSpec[], number] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [[], 0];
  const fields: FieldSpec[] = [];
  let skipped = 0;
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (key === "$schema") continue;
    if (typeof item === "boolean") fields.push({ key, kind: "boolean" });
    else if (typeof item === "number") fields.push({ key, kind: "number", integer: Number.isInteger(item) });
    else if (typeof item === "string") fields.push({ key, kind: SECRET_KEY.test(key) ? "secret" : "string" });
    else skipped++;
  }
  return [fields, skipped];
}

/** 解析 JSON/JSONC 文本为对象；语法错误时返回 undefined */
export function parseJsonText(text: string): Record<string, unknown> | undefined {
  const errors: ParseError[] = [];
  const value = parse(text || "{}", errors, { allowTrailingComma: true });
  if (errors.length || !value || typeof value !== "object" || Array.isArray(value)) return undefined;
  return value as Record<string, unknown>;
}

/** 修改 JSON 文本中的一个顶层字段，保留其余格式与注释（与原实现相同的 modify 选项） */
export function setJsonField(text: string, key: string, value: unknown): string {
  return applyEdits(text, modify(text || "{}", [key], value, { formattingOptions: { insertSpaces: true, tabSize: 2 } }));
}

/** server.properties 的常用字段清单（BDS 官方默认文件中均存在） */
export const PROPERTY_FIELDS: FieldSpec[] = [
  { group: "基本", key: "server-name", label: "服务器名称", kind: "string", description: "显示在玩家服务器列表中的名称" },
  { group: "基本", key: "level-name", label: "世界名称", kind: "string", description: "worlds 目录下的世界文件夹名" },
  { group: "基本", key: "gamemode", label: "游戏模式", kind: "enum", options: [{ value: "survival", label: "生存" }, { value: "creative", label: "创造" }, { value: "adventure", label: "冒险" }] },
  { group: "基本", key: "force-gamemode", label: "强制游戏模式", kind: "boolean", description: "玩家重新加入时强制使用上面的游戏模式" },
  { group: "基本", key: "difficulty", label: "难度", kind: "enum", options: [{ value: "peaceful", label: "和平" }, { value: "easy", label: "简单" }, { value: "normal", label: "普通" }, { value: "hard", label: "困难" }] },
  { group: "基本", key: "allow-cheats", label: "允许作弊", kind: "boolean", description: "允许使用命令等作弊功能" },
  { group: "玩家", key: "max-players", label: "最大玩家数", kind: "number", integer: true, min: 1 },
  { group: "玩家", key: "online-mode", label: "正版验证", kind: "boolean", description: "要求玩家通过 Xbox Live 验证" },
  { group: "玩家", key: "allow-list", label: "启用允许名单", kind: "boolean", description: "仅允许名单中的玩家加入（名单在“玩家与权限”中管理）" },
  { group: "玩家", key: "default-player-permission-level", label: "新玩家默认权限", kind: "enum", options: [{ value: "visitor", label: "访客" }, { value: "member", label: "成员" }, { value: "operator", label: "管理员" }] },
  { group: "玩家", key: "player-idle-timeout", label: "挂机踢出（分钟）", kind: "number", integer: true, min: 0, description: "0 表示不踢出" },
  { group: "玩家", key: "texturepack-required", label: "强制资源包", kind: "boolean" },
  { group: "网络", key: "server-port", label: "IPv4 端口", kind: "number", integer: true, min: 1, max: 65535 },
  { group: "网络", key: "server-portv6", label: "IPv6 端口", kind: "number", integer: true, min: 1, max: 65535 },
  { group: "性能", key: "view-distance", label: "视距（区块）", kind: "number", integer: true, min: 5 },
  { group: "性能", key: "tick-distance", label: "模拟距离（区块）", kind: "number", integer: true, min: 4, max: 12 },
  { group: "性能", key: "max-threads", label: "最大线程数", kind: "number", integer: true, min: 0, description: "0 表示尽可能多地使用线程" },
  { group: "诊断", key: "content-log-file-enabled", label: "写入内容日志文件", kind: "boolean" },
];

/** 解析 server.properties 为有序键值表（忽略注释与空行） */
export function parseProperties(text: string): Map<string, string> {
  const values = new Map<string, string>();
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = line.indexOf("=");
    if (index > 0) values.set(line.slice(0, index).trim(), line.slice(index + 1));
  }
  return values;
}

/** 修改 server.properties 中的一个键：存在则原位替换该行，不存在则追加到末尾；保留换行风格 */
export function setProperty(text: string, key: string, value: string): string {
  const newline = text.includes("\r\n") ? "\r\n" : "\n";
  const lines = text.split(/\r?\n/);
  const index = lines.findIndex((line) => !line.trim().startsWith("#") && line.slice(0, line.indexOf("=")).trim() === key);
  const safe = value.replace(/[\r\n]/g, "");
  if (index >= 0) lines[index] = `${key}=${safe}`;
  else {
    if (lines.length && lines.at(-1) === "") lines.splice(lines.length - 1, 0, `${key}=${safe}`);
    else lines.push(`${key}=${safe}`);
  }
  return lines.join(newline);
}
