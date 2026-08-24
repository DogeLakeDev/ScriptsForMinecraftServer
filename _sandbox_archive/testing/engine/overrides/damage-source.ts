/**
 * EntityDamageSource 薄袋：从 applyDamage options 抽出 cause / 伤害来源实体。
 * 对齐 pin：EntityApplyDamageOptions | EntityApplyDamageByProjectileOptions → EntityDamageSource。
 * 不模拟击退 / 无敌帧 / 伤害类型表。
 */

/** afterEvents.entityHurt / entityDie 上的 damageSource。 */
export type FakeEntityDamageSource = {
  cause: unknown;
  damagingEntity?: unknown;
  damagingProjectile?: unknown;
};

/** 对齐 EntityApplyDamageOptions（近战 / 环境伤等）。 */
export type FakeEntityApplyDamageOptions = {
  cause: unknown;
  damagingEntity?: unknown;
};

/**
 * 对齐 EntityApplyDamageByProjectileOptions。
 * damagingProjectile 必填；无 cause 时归一化为 "projectile"。
 */
export type FakeEntityApplyDamageByProjectileOptions = {
  damagingProjectile: unknown;
  damagingEntity?: unknown;
};

export type FakeApplyDamageOptions =
  | FakeEntityApplyDamageOptions
  | FakeEntityApplyDamageByProjectileOptions
  | FakeEntityDamageSource
  | { damageSource: unknown };

function pickEntityRef(v: unknown): unknown | undefined {
  if (v == null) return undefined;
  // 保留 Entity 实例引用，便于 === 断言；非对象字面量原样丢弃
  if (typeof v !== "object") return undefined;
  return v;
}

/** 归一化为 afterEvents.entityHurt / entityDie 的 damageSource。 */
export function toDamageSource(options?: unknown): FakeEntityDamageSource {
  if (options == null || typeof options !== "object") {
    return { cause: "none" };
  }
  const o = options as Record<string, unknown>;
  // 允许直接传 { damageSource } 袋
  if (o.damageSource != null && typeof o.damageSource === "object") {
    return toDamageSource(o.damageSource);
  }

  const projectile = "damagingProjectile" in o ? pickEntityRef(o.damagingProjectile) : undefined;
  const damager = "damagingEntity" in o ? pickEntityRef(o.damagingEntity) : undefined;

  // EntityApplyDamageByProjectileOptions 无 cause → 推断 projectile
  let cause: unknown;
  if ("cause" in o) {
    cause = o.cause ?? "none";
  } else if (projectile !== undefined) {
    cause = "projectile";
  } else {
    cause = "none";
  }

  const out: FakeEntityDamageSource = { cause };
  if (damager !== undefined) out.damagingEntity = damager;
  if (projectile !== undefined) out.damagingProjectile = projectile;
  return out;
}
