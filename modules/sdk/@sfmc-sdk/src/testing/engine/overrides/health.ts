/**
 * 假 EntityHealthComponent — 生命值袋，不模拟护甲/抗性/击退等物理。
 */

import { guardUnimplemented, UnimplementedMinecraftApiError } from "../unimplemented-error.js";

export const HEALTH_COMPONENT_ID = "minecraft:health" as const;

export type FakeEntityHealthComponent = {
  typeId: string;
  readonly currentValue: number;
  readonly defaultValue: number;
  readonly effectiveMax: number;
  readonly effectiveMin: number;
  resetToDefaultValue(): void;
  resetToMaxValue(): void;
  resetToMinValue(): void;
  setCurrentValue(value: number): boolean;
};

export type CreateHealthOpts = {
  max?: number;
  current?: number;
  defaultValue?: number;
  min?: number;
  /** 值变化时回调（applyDamage / setCurrentValue） */
  onChange?: (oldValue: number, newValue: number) => void;
};

export function createEntityHealthComponent(opts: CreateHealthOpts = {}): FakeEntityHealthComponent {
  const effectiveMax = opts.max ?? 20;
  const effectiveMin = opts.min ?? 0;
  const defaultValue = opts.defaultValue ?? effectiveMax;
  let current = opts.current ?? defaultValue;
  current = Math.min(effectiveMax, Math.max(effectiveMin, current));

  const set = (next: number): boolean => {
    const clamped = Math.min(effectiveMax, Math.max(effectiveMin, next));
    if (clamped === current) return false;
    const old = current;
    current = clamped;
    opts.onChange?.(old, current);
    return true;
  };

  const api: FakeEntityHealthComponent = {
    typeId: HEALTH_COMPONENT_ID,
    get currentValue() {
      return current;
    },
    defaultValue,
    effectiveMax,
    effectiveMin,
    resetToDefaultValue() {
      set(defaultValue);
    },
    resetToMaxValue() {
      set(effectiveMax);
    },
    resetToMinValue() {
      set(effectiveMin);
    },
    setCurrentValue(value) {
      const n = Number(value);
      if (!Number.isFinite(n)) return false;
      set(n);
      return true;
    },
  };

  return guardUnimplemented(api, "EntityHealthComponent") as FakeEntityHealthComponent;
}

/** 对齐 static componentId；`new EntityHealthComponent()` 硬失败。 */
export const EntityHealthComponent = Object.assign(
  function EntityHealthComponentCtor(): never {
    throw new UnimplementedMinecraftApiError("new EntityHealthComponent()");
  },
  {
    componentId: HEALTH_COMPONENT_ID,
  }
);

export function isHealthComponentId(componentId: string): boolean {
  const id = String(componentId ?? "");
  return (
    id === HEALTH_COMPONENT_ID ||
    id === "health" ||
    id === EntityHealthComponent.componentId
  );
}

/** 默认最大生命：玩家 20；其它实体也用 20（薄 L2，不按 typeId 查表）。 */
export function defaultMaxHealth(_typeId?: string): number {
  return 20;
}
