/**
 * HoloEntity — 全息实体管理器
 *
 * 管理世界中的 sfmc:hologram 实体生命周期：
 *   生成、更新、移除，以及 EntityHitEvent 监听。
 */
import { world, Player, Entity, Vector3, system } from "@minecraft/server";

// ── 常量 ──────────────────────────────────────────────

/** 全息实体的 identifier */
const HOLOGRAM_ENTITY_ID = "sfmc:hologram";

/** 存储在实体上的动态属性键名 */
const DP_PROJECTION_ID = "hpbe_projection_id";
const DP_OWNER_ID = "hpbe_owner_id";
const DP_SCALE = "hpbe_scale";
const DP_OPACITY = "hpbe_opacity";
const DP_ROTATION = "hpbe_rotation";
const DP_VISIBLE = "hpbe_visible";
const DP_LAYER = "hpbe_layer";
const DP_OFFSET_X = "hpbe_offset_x";
const DP_OFFSET_Y = "hpbe_offset_y";
const DP_OFFSET_Z = "hpbe_offset_z";

// ── 内部类型 ──────────────────────────────────────────

interface ActiveHologram {
  entity: Entity;
  projectionId: string;
  ownerId: string;
}

// ── 管理器 ────────────────────────────────────────────

export class HoloEntity {
  /** projectionId → ActiveHologram */
  private static activeHolograms: Map<string, ActiveHologram> = new Map();

  // ──────── 公开方法 ────────

  /**
   * 在世界中生成全息实体
   * @param player    所属玩家
   * @param projectionId  投影 ID
   * @param location  生成位置
   * @returns 生成的 Entity，失败返回 null
   */
  static spawnProjection(player: Player, projectionId: string, location: Vector3): Entity | null {
    try {
      const dimension = player.dimension;
      const entity = dimension.spawnEntity(HOLOGRAM_ENTITY_ID as any, location);

      // 记录元数据
      entity.setDynamicProperty(DP_PROJECTION_ID, projectionId);
      entity.setDynamicProperty(DP_OWNER_ID, player.id);

      // 注册到活跃映射
      this.activeHolograms.set(projectionId, {
        entity,
        projectionId,
        ownerId: player.id,
      });

      console.info(`[HoloEntity] 已生成投影 ${projectionId} 于 ${location.x},${location.y},${location.z}`);
      return entity;
    } catch (err) {
      console.error(`[HoloEntity] 生成投影失败 ${projectionId}: ${err}`);
      return null;
    }
  }

  /**
   * 移除指定投影实体
   * @param projectionId  投影 ID
   * @returns 是否成功移除
   */
  static removeProjection(projectionId: string): boolean {
    const entry = this.activeHolograms.get(projectionId);
    if (!entry) {
      console.warn(`[HoloEntity] 投影 ${projectionId} 不存在于活跃映射中`);
      return false;
    }

    try {
      entry.entity.remove();
      this.activeHolograms.delete(projectionId);
      console.info(`[HoloEntity] 已移除投影 ${projectionId}`);
      return true;
    } catch (err) {
      console.error(`[HoloEntity] 移除投影失败 ${projectionId}: ${err}`);
      // 即使移除实体失败，也从映射中清理
      this.activeHolograms.delete(projectionId);
      return false;
    }
  }

  /**
   * 更新实体属性（透明度、比例等）
   *
   * 实体的几何体由资源包渲染控制器驱动，此处仅更新动态属性，
   * 渲染控制器通过 Molang 查询这些属性来调节视觉效果。
   *
   * @param projectionId  投影 ID
   * @param settings      要更新的设置字段
   * @returns 是否成功更新
   */
  static updateProjection(projectionId: string, settings: Record<string, any>): boolean {
    const entry = this.activeHolograms.get(projectionId);
    if (!entry) {
      console.warn(`[HoloEntity] 投影 ${projectionId} 不存在，无法更新`);
      return false;
    }

    try {
      const entity = entry.entity;

      if (settings.scale !== undefined) entity.setDynamicProperty(DP_SCALE, settings.scale);
      if (settings.opacity !== undefined) entity.setDynamicProperty(DP_OPACITY, settings.opacity);
      if (settings.rotation !== undefined) entity.setDynamicProperty(DP_ROTATION, settings.rotation);
      if (settings.visible !== undefined) entity.setDynamicProperty(DP_VISIBLE, settings.visible);
      if (settings.layer !== undefined) entity.setDynamicProperty(DP_LAYER, settings.layer);
      if (settings.offsetX !== undefined) entity.setDynamicProperty(DP_OFFSET_X, settings.offsetX);
      if (settings.offsetY !== undefined) entity.setDynamicProperty(DP_OFFSET_Y, settings.offsetY);
      if (settings.offsetZ !== undefined) entity.setDynamicProperty(DP_OFFSET_Z, settings.offsetZ);

      return true;
    } catch (err) {
      console.error(`[HoloEntity] 更新投影失败 ${projectionId}: ${err}`);
      return false;
    }
  }

  /**
   * 获取玩家操作的投影 ID
   * @param entity  全息实体实例
   * @returns 投影 ID 或 null
   */
  static getProjectionForEntity(entity: Entity): string | null {
    const projectionId = entity.getDynamicProperty(DP_PROJECTION_ID);
    return (projectionId as string) ?? null;
  }

  /**
   * 注册事件（由 entry.ts 统一调用）
   */
  static registerEvents(): void {
    // 订阅实体击打事件 -> 打开操作菜单
    world.afterEvents.entityHitEntity.subscribe((event) => {
      const { damagingEntity, hitEntity } = event;

      if (hitEntity.typeId !== HOLOGRAM_ENTITY_ID) return;
      if (!(damagingEntity instanceof Player)) return;

      // 通过 dynamic property 获取对应的 projectionId
      const projectionId = hitEntity.getDynamicProperty(DP_PROJECTION_ID) as string | undefined;
      if (!projectionId) return;

      console.info(`[HoloEntity] 玩家 ${damagingEntity.name} 点击了全息投影 ${projectionId}`);

      // TODO: 后续由 HoloGUI 打开操作菜单
      // HoloGUI.showOperationMenu(damagingEntity, projectionId);
    });
  }

  /**
   * 初始化所有活跃全息实体
   *
   * 在 worldLoad 时调用，扫描所有已存在的 sfmc:hologram 实体并重新注册
   */
  static init(): void {
    // 重注册现有实体
    try {
      const dimensions = ["overworld", "nether", "the_end"] as const;
      let count = 0;

      for (const dimId of dimensions) {
        const dim = world.getDimension(dimId);
        const entities = dim.getEntities({ type: HOLOGRAM_ENTITY_ID });

        for (const entity of entities) {
          const projectionId = entity.getDynamicProperty(DP_PROJECTION_ID) as string | undefined;
          const ownerId = entity.getDynamicProperty(DP_OWNER_ID) as string | undefined;

          if (projectionId && ownerId) {
            this.activeHolograms.set(projectionId, { entity, projectionId, ownerId });
            count++;
          }
        }
      }

      console.info(`[HoloEntity] 初始化完成，已注册 ${count} 个活跃全息实体`);
    } catch (err) {
      console.error(`[HoloEntity] 初始化扫描失败: ${err}`);
    }
  }
}
