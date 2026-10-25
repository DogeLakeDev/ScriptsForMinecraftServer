/**
 * server-properties-fields.ts — server.properties 的表单字段清单
 *
 * 使用场景：平台 config.read 读取 bds/server.properties 时附带完整字段清单，
 * 桌面端与小程序据此渲染「BDS配置」表单。
 * 取值类型、枚举值与范围在这里维护（与语言无关）；名称、说明与枚举展示名来自 server-properties-i18n.ts。
 * 本文件不依赖 Node API。
 */
import {
  getServerPropertyDoc,
  getServerPropertyGroupLabel,
  type ServerPropertyGroup,
  type ServerPropertyKey,
} from "./server-properties-i18n.js";

/** 单个属性的取值约束 */
interface ServerPropertySpec {
  group: ServerPropertyGroup;
  type: "boolean" | "integer" | "number" | "string" | "enum";
  /** enum 的合法取值 */
  values?: readonly string[];
  min?: number;
  max?: number;
}

/** UDP / TCP 端口范围，用于各端口字段 */
const PORT_RANGE = { min: 1, max: 65535 } as const;

/**
 * 字典收录的每个属性的取值约束，按表单展示顺序排列。
 * 类型为 Record<ServerPropertyKey, …>：与 i18n 字典的键漏写或多写都会编译报错。
 * 取值约束只写字典 values 中明确说明的范围；说明与实际版本不一致的键按文本处理，避免表单写入非法值。
 */
export const SERVER_PROPERTY_SPECS: Record<ServerPropertyKey, ServerPropertySpec> = {
  "server-name": { group: "basic", type: "string" },
  "level-name": { group: "basic", type: "string" },
  "level-seed": { group: "basic", type: "string" },
  "gamemode": { group: "basic", type: "enum", values: ["survival", "creative", "adventure"] },
  "force-gamemode": { group: "basic", type: "boolean" },
  "difficulty": { group: "basic", type: "enum", values: ["peaceful", "easy", "normal", "hard"] },
  "allow-cheats": { group: "basic", type: "boolean" },

  "max-players": { group: "player", type: "integer", min: 1 },
  "online-mode": { group: "player", type: "boolean" },
  "allow-list": { group: "player", type: "boolean" },
  "white-list": { group: "player", type: "boolean" },
  "default-player-permission-level": { group: "player", type: "enum", values: ["visitor", "member", "operator"] },
  "player-idle-timeout": { group: "player", type: "integer", min: 0 },
  "texturepack-required": { group: "player", type: "boolean" },
  "chat-restriction": { group: "player", type: "enum", values: ["None", "Dropped", "Disabled"] },
  "disable-player-interaction": { group: "player", type: "boolean" },
  "disable-persona": { group: "player", type: "boolean" },
  "disable-custom-skins": { group: "player", type: "boolean" },

  "server-port": { group: "network", type: "integer", ...PORT_RANGE },
  "server-portv6": { group: "network", type: "integer", ...PORT_RANGE },
  "enable-lan-visibility": { group: "network", type: "boolean" },
  "transport": { group: "network", type: "string" },
  "compression-threshold": { group: "network", type: "integer", min: 0, max: 65535 },
  "compression-algorithm": { group: "network", type: "enum", values: ["zlib", "snappy"] },
  "websocket-retry-time": { group: "network", type: "integer", min: 1 },

  "view-distance": { group: "performance", type: "integer", min: 5 },
  "tick-distance": { group: "performance", type: "integer", min: 4, max: 12 },
  "max-threads": { group: "performance", type: "integer", min: 0 },
  "client-side-chunk-generation-enabled": { group: "performance", type: "boolean" },
  "block-network-ids-are-hashes": { group: "performance", type: "boolean" },
  "server-build-radius-ratio": { group: "performance", type: "string" },

  "server-authoritative-movement": { group: "movement", type: "enum", values: ["server-auth", "client-auth"] },
  "player-movement-score-threshold": { group: "movement", type: "integer" },
  "player-movement-action-direction-threshold": { group: "movement", type: "number" },
  "player-movement-distance-threshold": { group: "movement", type: "number" },
  "player-movement-duration-threshold-in-ms": { group: "movement", type: "integer", min: 0 },
  "correct-player-movement": { group: "movement", type: "boolean" },
  "server-authoritative-block-breaking": { group: "movement", type: "string" },

  "allow-outbound-script-debugging": { group: "script", type: "boolean" },
  "allow-inbound-script-debugging": { group: "script", type: "boolean" },
  "force-inbound-debug-port": { group: "script", type: "integer", ...PORT_RANGE },
  "script-debugger-auto-attach": { group: "script", type: "enum", values: ["disabled", "connect", "listen"] },
  "script-debugger-auto-attach-connect-address": { group: "script", type: "string" },

  "content-log-file-enabled": { group: "diagnostics", type: "boolean" },
  "content-log-console-output-enabled": { group: "diagnostics", type: "boolean" },
  "emit-server-telemetry": { group: "diagnostics", type: "boolean" },
};

/**
 * 表单字段描述。结构与 @sfmc-bds/management 的 ConfigFormField 相同（本包不依赖管理协议包）。
 * 使用场景：serverPropertyFormFields 的返回值，由平台放进 ConfigDocument.fields。
 */
export interface ServerPropertyFormField {
  key: string;
  label?: string;
  description?: string;
  kind: "boolean" | "number" | "string" | "enum";
  options?: { value: string; label: string }[];
  min?: number;
  max?: number;
  integer?: boolean;
  group?: string;
}

/**
 * 生成 server.properties 的完整表单字段清单（按 SERVER_PROPERTY_SPECS 的顺序）。
 * 说明文字：开关与枚举由控件表达取值，只拼概述与提示；文本与数字另附字典中的取值说明。
 * 目标语言没有字典时，名称、说明缺省（界面回退显示 key），分组名回退为分组标识。
 */
export function serverPropertyFormFields(locale: string = "zh-CN"): ServerPropertyFormField[] {
  return (Object.entries(SERVER_PROPERTY_SPECS) as [ServerPropertyKey, ServerPropertySpec][]).map(([key, spec]) => {
    const doc = getServerPropertyDoc(key, locale);
    const controlShowsValues = spec.type === "boolean" || spec.type === "enum";
    const description = doc
      ? [doc.desc, !controlShowsValues && doc.values ? `取值：${doc.values}` : "", doc.tip ? `提示：${doc.tip}` : ""].filter(Boolean).join("。")
      : undefined;
    const field: ServerPropertyFormField = {
      key,
      kind: spec.type === "integer" ? "number" : spec.type,
      group: getServerPropertyGroupLabel(spec.group, locale) ?? spec.group,
      ...(doc ? { label: doc.label } : {}),
      ...(description ? { description } : {}),
      ...(spec.type === "integer" ? { integer: true } : spec.type === "number" ? { integer: false } : {}),
      ...(spec.min !== undefined ? { min: spec.min } : {}),
      ...(spec.max !== undefined ? { max: spec.max } : {}),
    };
    if (spec.type === "enum") field.options = (spec.values ?? []).map((value) => ({ value, label: doc?.options?.[value] ?? value }));
    return field;
  });
}
