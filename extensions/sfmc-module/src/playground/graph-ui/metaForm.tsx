import type { ReactNode } from "react";

export type MetaProp = {
  name: string;
  readonly?: boolean;
  type?: string;
  /** overrides 自有成员 → l2；l2-skip → skip；其余 TARGET 默认 l0 */
  impl?: "l0" | "l2" | "skip";
};

export type MetaMethodParam = {
  name: string;
  type: string;
  optional?: boolean;
  rest?: boolean;
};

export type MetaMethod = {
  name: string;
  parameters?: MetaMethodParam[];
  impl?: "l0" | "l2" | "skip";
};

export type ClassMeta = {
  properties: MetaProp[];
  methods?: MetaMethod[];
  kind?: string;
  extends?: string;
};

export type PlaygroundMeta = {
  classes: Record<string, ClassMeta>;
  events?: Record<string, string[]>;
  eventTypes: Record<string, { eventType: string; signalType?: string }>;
};

export type SceneSummary = {
  world?: { id: string; kind: string };
  scoreboard?: { id: string; kind: string };
  dimensions?: { id: string; kind: string; dimensionId: string }[];
  players?: { id: string; kind: string; name: string }[];
  entities?: { id: string; kind: string; typeId?: string }[];
  items?: { id: string; kind: string; typeId?: string }[];
  blocks?: { id: string; kind: string }[];
  lastEmit?: {
    path: string;
    payload?: unknown;
    result?: unknown;
    at?: number;
    listeners?: number;
    errors?: { message: string }[];
  } | null;
  lastCall?: {
    id: string;
    method: string;
    result?: unknown;
    at?: number;
  } | null;
  module?: string | null;
  moduleRoot?: string | null;
  moduleBinding?: ModuleBinding;
  subscribedEvents?: { path: string; listeners: number }[];
};

/** 当前模块 ↔ 沙箱宿主绑定（boot 后由 host 汇报） */
export type ModuleBinding = {
  moduleRoot?: string | null;
  id?: string | null;
  version?: string | null;
  enabled?: boolean | null;
  afterWorldLoad?: boolean | null;
  status?: "loaded" | "engine-only" | "pending" | string;
  subscribedEvents?: { path: string; listeners: number }[];
  eventNote?: string;
  /** 已注册 ! 命令（可枚举时带 items） */
  commands?: {
    enumerable: boolean;
    items?: {
      name: string;
      permission?: number | string;
      description?: string;
      moduleId?: string;
    }[];
  };
  /** 已注册命名权限 */
  permissions?: {
    enumerable: boolean;
    items?: { name: string; level: number }[];
    note?: string;
  };
  /** boot 分相 */
  bootPhase?: {
    startup: boolean;
    worldLoad: boolean;
    summary: string;
  };
};

/** 沙箱创建 Player 入口字段（非 d.ts 表面，与 FakePlayerInit 对齐） */
export const PLAYER_CREATE_ENTRY: MetaProp[] = [
  { name: "name", type: "string", readonly: false },
  { name: "op", type: "boolean", readonly: false },
  { name: "dimensionId", type: "string", readonly: false },
  { name: "location", type: "Vector3", readonly: false },
];

/** 沙箱创建 Entity 入口字段（对齐 objects.create Entity） */
export const ENTITY_CREATE_ENTRY: MetaProp[] = [
  { name: "typeId", type: "string", readonly: false },
  { name: "dimensionId", type: "string", readonly: false },
  { name: "location", type: "Vector3", readonly: false },
];

/** 沙箱创建 ItemStack 入口字段（对齐 objects.create ItemStack） */
export const ITEM_CREATE_ENTRY: MetaProp[] = [
  { name: "typeId", type: "string", readonly: false },
  { name: "amount", type: "number", readonly: false },
];

export function defaultForType(type?: string): unknown {
  const t = type ?? "unknown";
  if (t === "boolean") return false;
  if (t === "number") return 0;
  if (t === "string") return "";
  // Foo | string 给空串；string[] 仍走下方 []
  if (/\|/.test(t) && /\bstring\b/i.test(t) && !t.endsWith("[]")) return "";
  if (t === "Vector3" || t === "minecraftcommon.Vector3" || /^location$/i.test(t)) {
    return { x: 0, y: 64, z: 0 };
  }
  if (t.endsWith("[]")) return [];
  if (t === "Player" || t === "Entity" || t === "Dimension" || t === "ItemStack" || t === "Block") {
    return null;
  }
  return null;
}

export function writableProps(meta: PlaygroundMeta | null, className: string): MetaProp[] {
  const list = meta?.classes[className]?.properties ?? [];
  return list.filter((p) => !p.readonly);
}

export function allProps(meta: PlaygroundMeta | null, className: string): MetaProp[] {
  return meta?.classes[className]?.properties ?? [];
}

/** Player 创建袋：入口字段 + Player/Entity 可写表面（去重） */
export function playerCreateProps(meta: PlaygroundMeta | null): MetaProp[] {
  const seen = new Set<string>();
  const out: MetaProp[] = [];
  for (const p of [...PLAYER_CREATE_ENTRY, ...writableProps(meta, "Player"), ...writableProps(meta, "Entity")]) {
    if (seen.has(p.name)) continue;
    seen.add(p.name);
    out.push(p);
  }
  return out;
}

/** Entity 创建袋：入口字段 + Entity 可写表面（去重） */
export function entityCreateProps(meta: PlaygroundMeta | null): MetaProp[] {
  const seen = new Set<string>();
  const out: MetaProp[] = [];
  for (const p of [...ENTITY_CREATE_ENTRY, ...writableProps(meta, "Entity")]) {
    if (seen.has(p.name)) continue;
    seen.add(p.name);
    out.push(p);
  }
  return out;
}

/** ItemStack 创建袋：入口字段 + ItemStack 可写表面（去重） */
export function itemCreateProps(meta: PlaygroundMeta | null): MetaProp[] {
  const seen = new Set<string>();
  const out: MetaProp[] = [];
  for (const p of [...ITEM_CREATE_ENTRY, ...writableProps(meta, "ItemStack")]) {
    if (seen.has(p.name)) continue;
    seen.add(p.name);
    out.push(p);
  }
  return out;
}

export function eventProps(meta: PlaygroundMeta | null, path: string): MetaProp[] {
  const eventType = meta?.eventTypes[path]?.eventType;
  if (!eventType) return [];
  return allProps(meta, eventType);
}

export function seedProps(fields: MetaProp[], existing?: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...(existing ?? {}) };
  for (const f of fields) {
    if (out[f.name] === undefined) out[f.name] = defaultForType(f.type);
  }
  return out;
}

/** 方法形参 → MetaProp 表单字段（形参从不是 d.ts 属性只读；一律可填） */
export function methodParamFields(
  meta: PlaygroundMeta | null,
  className: string | undefined,
  methodName: string | undefined
): MetaProp[] {
  if (!meta || !className || !methodName) return [];
  const m = meta.classes[className]?.methods?.find((x) => x.name === methodName);
  if (!m?.parameters?.length) return [];
  // 不沿用同类属性的 readonly；Call 填参与方法 impl(l0/skip) 无关
  return m.parameters.map((p) => ({
    name: p.name,
    type: p.type,
    readonly: false,
  }));
}

/** 从形参字段袋生成 call args 数组（按 parameters 顺序） */
export function argsFromParamValues(
  fields: MetaProp[],
  values: Record<string, unknown>
): unknown[] {
  return fields.map((f) => values[f.name] ?? null);
}

export function seedArgsJson(
  meta: PlaygroundMeta | null,
  className: string | undefined,
  methodName: string | undefined,
  existingJson?: string
): string {
  const fields = methodParamFields(meta, className, methodName);
  if (!fields.length) return existingJson ?? "[]";
  try {
    const parsed = existingJson ? JSON.parse(existingJson) : null;
    if (Array.isArray(parsed) && parsed.length === fields.length) return existingJson!;
  } catch {
    /* ignore */
  }
  const bag = seedProps(fields, {});
  return JSON.stringify(argsFromParamValues(fields, bag));
}

function isVector3(v: unknown): v is { x: number; y: number; z: number } {
  return (
    !!v &&
    typeof v === "object" &&
    typeof (v as { x?: unknown }).x === "number" &&
    typeof (v as { y?: unknown }).y === "number" &&
    typeof (v as { z?: unknown }).z === "number"
  );
}

function refIdOf(v: unknown): string {
  if (v && typeof v === "object" && typeof (v as { $ref?: unknown }).$ref === "string") {
    return String((v as { $ref: string }).$ref);
  }
  return "";
}

type MetaPropFormProps = {
  fields: MetaProp[];
  values: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
  scene?: SceneSummary | null;
  /** true：全部只读（场景 inspect） */
  readOnly?: boolean;
  /**
   * Emit / Call 形参袋：即使字段带 meta.readonly 也可填。
   * 不看方法 impl(l0/skip)；未接线方法仍允许填参，调用时再硬失败。
   */
  forceEditable?: boolean;
};

/** 联合类型含 string（如 EffectType | string）走文本框；纯 string[] 仍走 JSON */
function isStringyType(type: string): boolean {
  if (
    type === "string" ||
    type === "CommandPermissionLevel" ||
    type === "PlayerPermissionLevel"
  ) {
    return true;
  }
  if (type.endsWith("[]")) return false;
  return /\|/.test(type) && /\bstring\b/i.test(type);
}

function isVector3Type(type: string): boolean {
  return type === "Vector3" || type === "minecraftcommon.Vector3" || /^location$/i.test(type);
}

function isRefType(type: string): type is "Player" | "Entity" | "Dimension" | "ItemStack" | "Block" {
  return (
    type === "Player" ||
    type === "Entity" ||
    type === "Dimension" ||
    type === "ItemStack" ||
    type === "Block"
  );
}

function jsonFieldText(raw: unknown): string {
  if (raw === undefined || raw === null) return "";
  if (typeof raw === "string") return raw;
  try {
    return JSON.stringify(raw, null, 2);
  } catch {
    return String(raw);
  }
}

export function MetaPropForm({
  fields,
  values,
  onChange,
  scene,
  readOnly,
  forceEditable,
}: MetaPropFormProps) {
  const setField = (name: string, value: unknown) => {
    onChange({ ...values, [name]: value });
  };

  if (!fields.length) {
    return <p className="muted">该类在 PLAYGROUND_META 中无属性</p>;
  }

  return (
    <div className="meta-form">
      {fields.map((f) => {
        // 仅面板级 readOnly，或（未 forceEditable 且字段标 readonly）才锁；与 impl 无关
        const locked = Boolean(readOnly || (!forceEditable && f.readonly));
        const type = f.type ?? "unknown";
        const raw = values[f.name];
        let control: ReactNode;

        if (type === "boolean") {
          control = (
            <select
              disabled={locked}
              value={raw ? "1" : "0"}
              onChange={(e) => setField(f.name, e.target.value === "1")}
            >
              <option value="1">true</option>
              <option value="0">false</option>
            </select>
          );
        } else if (type === "number") {
          control = (
            <input
              type="number"
              disabled={locked}
              value={typeof raw === "number" ? raw : Number(raw) || 0}
              onChange={(e) => setField(f.name, Number(e.target.value))}
            />
          );
        } else if (isVector3Type(type)) {
          const loc = isVector3(raw) ? raw : { x: 0, y: 64, z: 0 };
          control = (
            <div className="vec3">
              {(["x", "y", "z"] as const).map((axis) => (
                <label key={axis} className="vec3-axis">
                  <span>{axis}</span>
                  <input
                    type="number"
                    disabled={locked}
                    value={loc[axis]}
                    onChange={(e) =>
                      setField(f.name, { ...loc, [axis]: Number(e.target.value) })
                    }
                  />
                </label>
              ))}
            </div>
          );
        } else if (isRefType(type)) {
          const options =
            type === "Player"
              ? (scene?.players ?? []).map((p) => ({ id: p.id, label: p.name }))
              : type === "Entity"
                ? (scene?.entities ?? []).map((p) => ({
                    id: p.id,
                    label: p.typeId ? `${p.typeId} (${p.id})` : p.id,
                  }))
                : type === "ItemStack"
                  ? (scene?.items ?? []).map((p) => ({
                      id: p.id,
                      label: p.typeId ? `${p.typeId} (${p.id})` : p.id,
                    }))
                  : type === "Block"
                    ? (scene?.blocks ?? []).map((p) => ({ id: p.id, label: p.id }))
                    : (scene?.dimensions ?? []).map((d) => ({
                        id: d.id,
                        label: d.dimensionId,
                      }));
          control = (
            <select
              disabled={locked}
              value={refIdOf(raw)}
              onChange={(e) => {
                const id = e.target.value;
                setField(f.name, id ? { $ref: id } : null);
              }}
            >
              <option value="">（未绑定）</option>
              {options.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          );
        } else if (isStringyType(type)) {
          if (f.name === "dimensionId" && (scene?.dimensions?.length ?? 0) > 0) {
            control = (
              <select
                disabled={locked}
                value={raw == null ? "" : String(raw)}
                onChange={(e) => setField(f.name, e.target.value)}
              >
                {(scene?.dimensions ?? []).map((d) => (
                  <option key={d.id} value={d.dimensionId}>
                    {d.dimensionId}
                  </option>
                ))}
              </select>
            );
          } else {
            control = (
              <input
                disabled={locked}
                value={raw == null ? "" : String(raw)}
                onChange={(e) => setField(f.name, e.target.value)}
              />
            );
          }
        } else {
          // 复杂类型：允许输入中暂存原文，避免 JSON.parse 失败时控件像被禁用
          control = (
            <textarea
              rows={3}
              disabled={locked}
              value={jsonFieldText(raw)}
              onChange={(e) => {
                const text = e.target.value;
                if (!text.trim()) {
                  setField(f.name, null);
                  return;
                }
                try {
                  setField(f.name, JSON.parse(text));
                } catch {
                  setField(f.name, text);
                }
              }}
            />
          );
        }

        return (
          <div className="field" key={f.name}>
            <label>
              {f.name}
              <span className="field-type">
                {type}
                {locked ? " · 只读" : ""}
              </span>
            </label>
            {control}
          </div>
        );
      })}
    </div>
  );
}
