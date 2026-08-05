/**
 * 统一「目标」picker：把 targetKind / targetName / targetId 三个字段收敛到一行。
 *
 * 不改 AssertConfig 类型；只决定这三个字段的输入方式与序列化方向：
 * - Type 选 Player / Entity / ... → Name 来自 scene（玩家名 / typeId / dimensionId）；
 *   写回 { targetKind, targetName }（Player.name 等仍是 scene 里查到的字段）
 * - Type 选「指定 id」 → 副控件变成 id 文本框；写回 { targetId }（kind 留空让求值时按 id 前缀推断）
 * - 清空按钮一次性把三个字段都清掉
 *
 * 适用：assert.sceneExists / assert.count / assert.prop。
 * - sceneExists：byName + byId 都可用
 * - count：仅 byName（filterCountRows 忽略 targetId）
 * - prop：仅 byId（targetName 对 prop 语义无意义）
 */

import type { SceneSummary } from "./metaForm";

/** 「指定 id」哨兵值，存入 targetKind；求值时与 AssertConfig.targetId 协同解析 */
export const BY_ID_SENTINEL = "__by_id__";

export type TargetMode = "byName" | "byId";

export type TargetPickerProps = {
  scene: SceneSummary | null;
  targetKind?: string;
  targetName?: string;
  targetId?: string;
  /** 限定可用模式；缺省两个都给 */
  modes?: TargetMode[];
  /** 显示「任意」（空 option） */
  allowAny?: boolean;
  /** 缺省目标 kind（prop 强制 byId 时可不传） */
  defaultKind?: string;
  onChange: (next: {
    targetKind?: string;
    targetName?: string;
    targetId?: string;
  }) => void;
  /** 该 kind 在场景里没有 name 候选时（比如 Scoreboard / Block）显示「任意」 */
  emptyOptionLabel?: string;
};

/** 把当前 cfg 状态翻译成 mode（byName / byId / any） */
export function detectTargetMode(targetKind?: string): TargetMode | "any" {
  if (!targetKind) return "any";
  if (targetKind === BY_ID_SENTINEL) return "byId";
  return "byName";
}

/** 给定 kind，返回 name 下拉的候选（来自 scene） */
function namesForKind(scene: SceneSummary | null, kind: string): string[] {
  if (!scene) return [];
  const k = kind;
  if (k === "Player") return (scene.players ?? []).map((p) => p.name).filter((n): n is string => !!n);
  if (k === "Entity") return (scene.entities ?? []).map((e) => e.typeId).filter((n): n is string => !!n);
  if (k === "ItemStack") return (scene.items ?? []).map((i) => i.typeId).filter((n): n is string => !!n);
  if (k === "Dimension") return (scene.dimensions ?? []).map((d) => d.dimensionId).filter((n): n is string => !!n);
  if (k === "World") return scene.world ? [scene.world.id] : [];
  if (k === "Scoreboard") return scene.scoreboard ? [scene.scoreboard.id] : [];
  if (k === "Block") return (scene.blocks ?? []).map((b) => b.id);
  return [];
}

const KIND_OPTIONS: { value: string; label: string }[] = [
  { value: "Player", label: "Player" },
  { value: "Entity", label: "Entity" },
  { value: "ItemStack", label: "ItemStack" },
  { value: "Block", label: "Block" },
  { value: "Dimension", label: "Dimension" },
  { value: "World", label: "World" },
  { value: "Scoreboard", label: "Scoreboard" },
  { value: BY_ID_SENTINEL, label: "指定 id…" },
];

export function TargetPicker({
  scene,
  targetKind,
  targetName,
  targetId,
  modes,
  allowAny = true,
  defaultKind,
  onChange,
  emptyOptionLabel = "（不指定）",
}: TargetPickerProps) {
  const allowed: Set<TargetMode> = new Set(modes ?? ["byName", "byId"]);
  const mode = detectTargetMode(targetKind);

  // 若当前 cfg 是「any」但只允许 byId，则把 kind 升成默认 kind（prop / count 进入时常见）
  const effectiveKind = mode === "any" && defaultKind ? defaultKind : targetKind;

  // 当 cfg 没设 kind 但允许 any 时显示「任意」；byName / byId 仍要有一个真 kind
  const typeValue =
    mode === "any" && allowAny ? "" : effectiveKind ?? "";

  const onTypeChange = (raw: string) => {
    if (!raw) {
      // 任意
      onChange({ targetKind: undefined, targetName: undefined, targetId: undefined });
      return;
    }
    if (raw === BY_ID_SENTINEL) {
      onChange({ targetKind: BY_ID_SENTINEL, targetId: targetId ?? "" });
      return;
    }
    // 真 kind：默认选第一个 name（若 cfg 没有 targetName 但场景里有）
    const names = namesForKind(scene, raw);
    const nextName =
      raw === effectiveKind && targetName ? targetName : (names[0] ?? "");
    onChange({ targetKind: raw, targetName: nextName, targetId: undefined });
  };

  const onNameChange = (v: string) => {
    if (mode === "byId") {
      onChange({ targetKind: BY_ID_SENTINEL, targetId: v });
    } else {
      onChange({ targetKind: effectiveKind, targetName: v });
    }
  };

  const clear = () => {
    onChange({ targetKind: undefined, targetName: undefined, targetId: undefined });
  };

  const showTypeSelect = allowed.has("byName") || (allowed.has("byId") && (mode === "byId" || !!targetId));
  // 仅 byId 的场景（如 prop）：type 选择固定为「指定 id」
  const typeOptions = KIND_OPTIONS.filter(
    (o) => (o.value === BY_ID_SENTINEL && allowed.has("byId")) ||
            (o.value !== BY_ID_SENTINEL && allowed.has("byName"))
  );

  const secondary =
    mode === "byId" || (!allowed.has("byName") && allowed.has("byId")) ? (
      <input
        value={targetId ?? ""}
        placeholder="对象 id（如 player-alice）"
        onChange={(e) => onNameChange(e.target.value)}
      />
    ) : (
      <select
        value={targetName ?? ""}
        onChange={(e) => onNameChange(e.target.value)}
      >
        <option value="">{emptyOptionLabel}</option>
        {namesForKind(scene, effectiveKind ?? "").map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </select>
    );

  // 紧凑模式：只允许 byName 时，直接走 Name select，隐藏 Type（避免冗余）
  if (!allowed.has("byId") && allowed.has("byName")) {
    return (
      <div className="field">
        <label>目标（{effectiveKind ?? "任意"}）</label>
        <div className="target-row">
          <select
            value={effectiveKind ?? ""}
            onChange={onTypeChange}
            aria-label="kind"
          >
            {allowAny ? <option value="">{emptyOptionLabel}</option> : null}
            {typeOptions
              .filter((o) => o.value !== BY_ID_SENTINEL)
              .map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
          </select>
          {secondary}
          <button
            type="button"
            className="btn-secondary compact"
            onClick={clear}
            disabled={!effectiveKind && !targetName && !targetId}
            aria-label="清空目标"
            title="清空目标"
          >
            清空
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="field">
      <label>目标</label>
      <div className="target-row">
        <select
          value={typeValue}
          onChange={onTypeChange}
          aria-label="kind"
        >
          {allowAny ? <option value="">{emptyOptionLabel}</option> : null}
          {typeOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        {secondary}
        <button
          type="button"
          className="btn-secondary compact"
          onClick={clear}
          disabled={!effectiveKind && !targetName && !targetId}
          aria-label="清空目标"
          title="清空目标"
        >
          清空
        </button>
      </div>
    </div>
  );
}