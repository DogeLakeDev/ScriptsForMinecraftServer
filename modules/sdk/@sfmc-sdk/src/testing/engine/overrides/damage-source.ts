/**
 * EntityDamageSource 薄袋：从 applyDamage options 抽出 cause / 伤害来源实体。
 * 不模拟击退 / 无敌帧 / 伤害类型表。
 */

export type FakeEntityDamageSource = {
  cause: unknown;
  damagingEntity?: unknown;
  damagingProjectile?: unknown;
};

/** 归一化为 afterEvents.entityHurt / entityDie 的 damageSource。 */
export function toDamageSource(options?: unknown): FakeEntityDamageSource {
  if (options == null || typeof options !== "object") {
    return { cause: "none" };
  }
  const o = options as Record<string, unknown>;
  // 允许直接传 damageSource 袋
  if (o.damageSource != null && typeof o.damageSource === "object") {
    return toDamageSource(o.damageSource);
  }
  const cause = "cause" in o ? (o.cause ?? "none") : "none";
  const out: FakeEntityDamageSource = { cause };
  if ("damagingEntity" in o) out.damagingEntity = o.damagingEntity;
  if ("damagingProjectile" in o) out.damagingProjectile = o.damagingProjectile;
  return out;
}
