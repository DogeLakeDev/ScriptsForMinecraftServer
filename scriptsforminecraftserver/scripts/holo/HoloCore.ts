/**
 * HoloCore — Holoprint 核心逻辑编排器
 *
 * 管理上传、加载、操作执行的完整流程。
 * 依赖 HoloprintApi（网络层）和 HoloEntity（实体层）。
 */
import { Player, world, Vector3, system } from "@minecraft/server";
import { PlayerSelection, SelectionPoint, ProjectionData, DEFAULT_HOLO_SETTINGS } from "../data/HoloPrint";
import { HoloprintApi } from "../api/HoloprintApi";
import { HoloEntity } from "./HoloEntity";

// ── 常量 ──────────────────────────────────────────────

/** 结构管理器标识前缀 */
const STRUCTURE_ID_PREFIX = "hpbe_";

// ── 工具类型 ──────────────────────────────────────────

/** 上传配置（由 GUI 收集后传回） */
export interface UploadConfig {
  name: string;
  author: string;
  description: string;
  visibility: "public" | "private";
}

// ── 核心编排器 ───────────────────────────────────────

export class HoloCore {
  /**
   * 玩家选区状态
   * key: player.id
   */
  static playerSelections: Map<string, PlayerSelection> = new Map();

  // ──────── 选区操作 ────────

  /**
   * 设置玩家选区点
   * @param player    当前玩家
   * @param posNumber 1 = pos1, 2 = pos2
   */
  static setPos(player: Player, posNumber: 1 | 2): void {
    const loc = player.location;
    const point: SelectionPoint = { x: Math.floor(loc.x), y: Math.floor(loc.y), z: Math.floor(loc.z) };

    let sel = this.playerSelections.get(player.id);
    if (!sel) {
      sel = { pos1: null, pos2: null };
      this.playerSelections.set(player.id, sel);
    }

    if (posNumber === 1) {
      sel.pos1 = point;
      player.sendMessage(`§a[HPBE] 已设置位置1: ${point.x}, ${point.y}, ${point.z}`);
    } else {
      sel.pos2 = point;
      player.sendMessage(`§a[HPBE] 已设置位置2: ${point.x}, ${point.y}, ${point.z}`);
    }
  }

  // ──────── 上传流程 ────────

  /**
   * 执行上传流程
   *
   * 1. 检查选区完整性
   * 2. 使用 StructureManager 保存方块区域为临时结构
   * 3. 通过 HoloprintApi 上传结构元数据到 db-server
   * 4. 清理临时结构
   *
   * @param player  当前玩家
   * @param config  上传配置（名称、作者、描述、可见性）
   */
  static async startUpload(player: Player, config: UploadConfig): Promise<void> {
    try {
      // 1. 检查选区
      const sel = this.playerSelections.get(player.id);
      if (!sel || !sel.pos1 || !sel.pos2) {
        player.sendMessage("§c[HPBE] 请先使用 !hpbe pos1 和 !hpbe pos2 设置选区");
        return;
      }

      // 确保 pos1 是较小角，pos2 是较大角
      const min: Vector3 = {
        x: Math.min(sel.pos1.x, sel.pos2.x),
        y: Math.min(sel.pos1.y, sel.pos2.y),
        z: Math.min(sel.pos1.z, sel.pos2.z),
      };
      const max: Vector3 = {
        x: Math.max(sel.pos1.x, sel.pos2.x),
        y: Math.max(sel.pos1.y, sel.pos2.y),
        z: Math.max(sel.pos1.z, sel.pos2.z),
      };

      const sizeX = max.x - min.x + 1;
      const sizeY = max.y - min.y + 1;
      const sizeZ = max.z - min.z + 1;

      if (sizeX <= 0 || sizeY <= 0 || sizeZ <= 0) {
        player.sendMessage("§c[HPBE] 选区无效，请重新设置");
        return;
      }

      // 2. 保存结构
      const timestamp = Date.now();
      const structureId = `${STRUCTURE_ID_PREFIX}${player.id}_${timestamp}`;

      try {
        world.structureManager.createFromWorld(structureId, player.dimension, min, max);
      } catch (err) {
        player.sendMessage("§c[HPBE] 保存结构失败，选区可能包含未加载区块");
        console.error(`[HoloCore] createFromWorld 失败: ${err}`);
        return;
      }

      // 3. 保存结构引用到 db-server（不含二进制数据）
      const projectionData = {
        name: config.name,
        author: config.author,
        description: config.description,
        ownerId: player.id,
        visibility: config.visibility,
        scale: DEFAULT_HOLO_SETTINGS.scale,
        opacity: DEFAULT_HOLO_SETTINGS.opacity,
        sizeX,
        sizeY,
        sizeZ,
        blockCount: 0,
      };
      const success = await HoloprintApi.uploadHoloStructure(projectionData, "");

      // 4. 清理选区状态
      this.playerSelections.delete(player.id);

      if (success) {
        player.sendMessage(`§a[HPBE] 投影 "${config.name}" 上传成功！`);
        console.info(`[HoloCore] 玩家 ${player.name} 上传了投影 ${config.name}`);
      } else {
        player.sendMessage("§c[HPBE] 上传失败，请检查服务器连接");
      }
    } catch (err) {
      player.sendMessage("§c[HPBE] 上传过程中发生异常");
      console.error(`[HoloCore] startUpload 异常: ${err}`);
    }
  }

  // ──────── 加载流程 ────────

  /**
   * 获取并返回投影列表数据（公共 + 玩家私有）
   *
   * @param player  当前玩家
   * @returns 投影数据数组，用于 GUI 展示
   */
  static async loadProjectionList(player: Player): Promise<ProjectionData[] | null> {
    try {
      // 并行获取私有和公共投影
      const [privateProjections, publicProjections] = await Promise.all([
        HoloprintApi.getHoloProjections(player.id, "private"),
        HoloprintApi.getHoloProjections(undefined, "public"),
      ]);

      const all: ProjectionData[] = [];

      // 私有投影优先
      if (privateProjections && Array.isArray(privateProjections)) {
        all.push(...privateProjections.map(this.normalizeProjection));
      }

      // 公共投影在后（排除已在私有列表中的）
      const privateIds = new Set(privateProjections?.map((p: any) => p.id) ?? []);
      if (publicProjections && Array.isArray(publicProjections)) {
        for (const proj of publicProjections) {
          if (!privateIds.has(proj.id)) {
            all.push(this.normalizeProjection(proj));
          }
        }
      }

      if (all.length === 0) {
        player.sendMessage("§e[HPBE] 没有可用的投影");
        return [];
      }

      return all;
    } catch (err) {
      console.error(`[HoloCore] 加载投影列表失败: ${err}`);
      player.sendMessage("§c[HPBE] 获取投影列表失败，请检查服务器连接");
      return null;
    }
  }

  // ──────── 操作执行 ────────

  /**
   * 执行投影操作
   *
   * @param player        操作玩家
   * @param projectionId  投影 ID
   * @param operation     操作名
   * @param value         操作参数（可选）
   */
  static async executeOperation(player: Player, projectionId: string, operation: string, value?: any): Promise<void> {
    try {
      switch (operation) {
        case "materials":
          await this.handleMaterials(player, projectionId);
          break;
        case "toggle_visibility":
          await this.handleToggle(player, projectionId, "visible", value);
          break;
        case "set_scale":
          await this.handleSet(player, projectionId, "scale", value);
          break;
        case "set_opacity":
          await this.handleSet(player, projectionId, "opacity", value);
          break;
        case "set_rotation":
          await this.handleSet(player, projectionId, "rotation", value);
          break;
        case "move":
          await this.handleMove(player, projectionId, value);
          break;
        case "set_layer":
          await this.handleSet(player, projectionId, "layer", value);
          break;
        case "toggle_inspect":
          await this.handleToggle(player, projectionId, "blockInspect", value);
          break;
        case "delete":
          await this.handleDelete(player, projectionId);
          break;
        default:
          player.sendMessage(`§c[HPBE] 未知操作: ${operation}`);
      }
    } catch (err) {
      console.error(`[HoloCore] 执行操作 ${operation} 失败: ${err}`);
      player.sendMessage(`§c[HPBE] 操作执行失败: ${err}`);
    }
  }

  // ──────── 内部操作方法 ────────

  /** 获取并显示方块清单 */
  private static async handleMaterials(player: Player, projectionId: string): Promise<void> {
    const materials = await HoloprintApi.getHoloMaterials(projectionId);
    if (!materials || materials.length === 0) {
      player.sendMessage("§e[HPBE] 该投影没有方块清单数据");
      return;
    }
    // TODO: 由 HoloGUI 展示方块清单表单
    // HoloGUI.showMaterialList(player, projectionId, materials);
    player.sendMessage(`§a[HPBE] 共 ${materials.length} 种方块`);
  }

  /** 切换布尔属性 */
  private static async handleToggle(player: Player, projectionId: string, field: string, value?: any): Promise<void> {
    const currentValue = typeof value === "boolean" ? value : value === true;
    const newValue = !currentValue;

    const success = await HoloprintApi.updateHoloProjection(projectionId, { [field]: newValue });
    if (!success) {
      player.sendMessage("§c[HPBE] 更新失败");
      return;
    }

    HoloEntity.updateProjection(projectionId, { [field]: newValue });
    player.sendMessage(`§a[HPBE] ${field} 已切换为 ${newValue}`);
  }

  /** 设置数值属性 */
  private static async handleSet(player: Player, projectionId: string, field: string, value: any): Promise<void> {
    if (value === undefined) {
      player.sendMessage("§c[HPBE] 请提供有效的数值参数");
      return;
    }

    const settings: Record<string, any> = { [field]: value };
    const success = await HoloprintApi.updateHoloProjection(projectionId, settings);
    if (!success) {
      player.sendMessage("§c[HPBE] 更新失败");
      return;
    }

    HoloEntity.updateProjection(projectionId, settings);
    player.sendMessage(`§a[HPBE] ${field} 已更新为 ${value}`);
  }

  /** 移动投影（偏移量） */
  private static async handleMove(
    player: Player,
    projectionId: string,
    value?: { x: number; y: number; z: number }
  ): Promise<void> {
    if (!value || typeof value.x !== "number" || typeof value.y !== "number" || typeof value.z !== "number") {
      player.sendMessage("§c[HPBE] 请提供有效的偏移量 (x, y, z)");
      return;
    }

    const success = await HoloprintApi.updateHoloProjection(projectionId, {
      offsetX: value.x,
      offsetY: value.y,
      offsetZ: value.z,
    });
    if (!success) {
      player.sendMessage("§c[HPBE] 更新偏移失败");
      return;
    }

    HoloEntity.updateProjection(projectionId, {
      offsetX: value.x,
      offsetY: value.y,
      offsetZ: value.z,
    });
    player.sendMessage(`§a[HPBE] 已移动投影到偏移 ${value.x}, ${value.y}, ${value.z}`);
  }

  /** 删除投影 */
  private static async handleDelete(player: Player, projectionId: string): Promise<void> {
    const success = await HoloprintApi.deleteHoloProjection(projectionId);
    if (!success) {
      player.sendMessage("§c[HPBE] 删除投影失败");
      return;
    }

    HoloEntity.removeProjection(projectionId);
    player.sendMessage(`§a[HPBE] 投影已删除`);
    console.info(`[HoloCore] 玩家 ${player.name} 删除了投影 ${projectionId}`);
  }

  // ──────── 工具 ────────

  /**
   * 将 API 返回的原始数据规整为 ProjectionData
   */
  private static normalizeProjection(raw: any): ProjectionData {
    // 如果已经是 ProjectionData 格式则直接返回
    if (raw.settings && raw.ownerId !== undefined) {
      return raw as ProjectionData;
    }
    // 否则尝试从数据库行格式转换
    return {
      id: raw.id,
      name: raw.name,
      author: raw.author ?? "",
      description: raw.description ?? "",
      ownerId: raw.owner_id ?? raw.ownerId ?? "",
      isPublic: !!(raw.is_public ?? raw.isPublic ?? false),
      visibility: raw.visibility ?? (raw.isPublic ? "public" : "private"),
      settings: {
        scale: raw.scale ?? raw.settings?.scale ?? 1.0,
        offsetX: raw.offset_x ?? raw.settings?.offsetX ?? 0,
        offsetY: raw.offset_y ?? raw.settings?.offsetY ?? 0,
        offsetZ: raw.offset_z ?? raw.settings?.offsetZ ?? 0,
        rotation: raw.rotation ?? raw.settings?.rotation ?? 0,
        opacity: raw.opacity ?? raw.settings?.opacity ?? 1.0,
        layer: raw.layer ?? raw.settings?.layer ?? 0,
        visible: !!(raw.visible ?? raw.settings?.visible ?? true),
        spawnAnimation: !!(raw.spawn_animation ?? raw.settings?.spawnAnimation ?? false),
        blockInspect: !!(raw.block_inspect ?? raw.settings?.blockInspect ?? false),
        overlayTint: raw.overlay_tint ?? raw.settings?.overlayTint ?? "",
        overlayTintOpacity: raw.overlay_tint_opacity ?? raw.settings?.overlayTintOpacity ?? 0,
        textureOutlineWidth: raw.texture_outline_width ?? raw.settings?.textureOutlineWidth ?? 0,
        textureOutlineColor: raw.texture_outline_color ?? raw.settings?.textureOutlineColor ?? "",
        textureOutlineOpacity: raw.texture_outline_opacity ?? raw.settings?.textureOutlineOpacity ?? 0,
        layerMode: raw.layer_mode ?? raw.settings?.layerMode ?? "all",
      },
      dbVersion: raw.db_version ?? raw.dbVersion ?? 1,
      geometryFile: raw.geometry_file ?? raw.geometryFile ?? "",
      blockCount: raw.block_count ?? raw.blockCount ?? 0,
      sizeX: raw.size_x ?? raw.sizeX ?? 0,
      sizeY: raw.size_y ?? raw.sizeY ?? 0,
      sizeZ: raw.size_z ?? raw.sizeZ ?? 0,
      materials: raw.materials ?? [],
      createdAt: raw.created_at ?? raw.createdAt ?? 0,
      updatedAt: raw.updated_at ?? raw.updatedAt ?? 0,
    };
  }
}
