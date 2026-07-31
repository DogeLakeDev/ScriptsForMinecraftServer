/**
 * 假 Effect — 状态袋；不模拟粒子 / 周期伤害 / 属性修饰。
 */

import { guardUnimplemented, UnimplementedMinecraftApiError } from "../unimplemented-error.js";

export type FakeEffect = {
  readonly amplifier: number;
  readonly displayName: string;
  readonly duration: number;
  readonly isValid: boolean;
  readonly typeId: string;
};

export type FakeEntityEffectOptions = {
  amplifier?: number;
  showParticles?: boolean;
};

/** 规范化 effect 类型 id（字符串或带 getName() 的 EffectType）。 */
export function normalizeEffectTypeId(effectType: unknown): string {
  if (effectType == null) return "minecraft:unknown";
  if (typeof effectType === "string") {
    const s = effectType.trim();
    if (!s) return "minecraft:unknown";
    return s.includes(":") ? s : `minecraft:${s}`;
  }
  if (typeof effectType === "object" && typeof (effectType as { getName?: () => string }).getName === "function") {
    return normalizeEffectTypeId((effectType as { getName: () => string }).getName());
  }
  return normalizeEffectTypeId(String(effectType));
}

export function createFakeEffect(opts: {
  typeId: string;
  duration: number;
  amplifier?: number;
  displayName?: string;
}): FakeEffect {
  const typeId = normalizeEffectTypeId(opts.typeId);
  const amplifier = Math.max(0, Math.floor(Number(opts.amplifier) || 0));
  const duration = Math.max(0, Math.floor(Number(opts.duration) || 0));
  const api: FakeEffect = {
    typeId,
    amplifier,
    duration,
    displayName: opts.displayName ?? typeId,
    isValid: true,
  };
  return guardUnimplemented(api, "Effect") as FakeEffect;
}

/** `new Effect()` 硬失败。 */
export const Effect = function EffectCtor(): never {
  throw new UnimplementedMinecraftApiError("new Effect()");
};

/**
 * 挂到 Entity / Player 上的 effect 薄 API。
 * 同 typeId 再次 addEffect 覆盖；不推进 tick、不发 effectAdd 事件。
 */
export function createEffectBagMethods(isEntityValid: () => boolean) {
  /** typeId → Effect */
  const bag = new Map<string, FakeEffect>();

  return {
    addEffect(
      effectType: unknown,
      duration: number,
      options?: FakeEntityEffectOptions
    ): FakeEffect | undefined {
      if (!isEntityValid()) throw new Error("InvalidEntityError");
      const typeId = normalizeEffectTypeId(effectType);
      const ticks = Math.floor(Number(duration));
      if (!Number.isFinite(ticks) || ticks <= 0) return undefined;
      const effect = createFakeEffect({
        typeId,
        duration: ticks,
        ...(options?.amplifier !== undefined ? { amplifier: options.amplifier } : {}),
      });
      bag.set(typeId, effect);
      return effect;
    },
    getEffect(effectType: unknown): FakeEffect | undefined {
      if (!isEntityValid()) return undefined;
      return bag.get(normalizeEffectTypeId(effectType));
    },
    getEffects(): FakeEffect[] {
      if (!isEntityValid()) return [];
      return [...bag.values()];
    },
    removeEffect(effectType: unknown): boolean {
      if (!isEntityValid()) throw new Error("InvalidEntityError");
      return bag.delete(normalizeEffectTypeId(effectType));
    },
  };
}
