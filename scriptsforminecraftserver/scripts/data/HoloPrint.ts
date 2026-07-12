import type {
  ProjectionVisibility,
  LayerMode,
  HoloSettings,
  ProjectionData,
  ColorPreset,
  ProjectionRow,
} from "../types";
export type { ProjectionVisibility, LayerMode, HoloSettings, ProjectionData, ColorPreset, ProjectionRow };

/** 颜色预设列表 */
export const COLOR_PRESETS: ColorPreset[] = [
  { name: "白色", value: "255 255 255", hex: "#FFFFFF" },
  { name: "红色", value: "255 85 85", hex: "#FF5555" },
  { name: "橙色", value: "255 170 0", hex: "#FFAA00" },
  { name: "黄色", value: "255 255 85", hex: "#FFFF55" },
  { name: "绿色", value: "85 255 85", hex: "#55FF55" },
  { name: "青色", value: "85 255 255", hex: "#55FFFF" },
  { name: "蓝色", value: "85 85 255", hex: "#5555FF" },
  { name: "紫色", value: "170 0 170", hex: "#AA00AA" },
  { name: "粉色", value: "255 85 255", hex: "#FF55FF" },
  { name: "灰色", value: "170 170 170", hex: "#AAAAAA" },
];

/** 默认投影设置 */
export const DEFAULT_HOLO_SETTINGS: HoloSettings = {
  scale: 1.0,
  offsetX: 0,
  offsetY: 0,
  offsetZ: 0,
  rotation: 0,
  opacity: 1.0,
  layer: 0,
  visible: true,
  spawnAnimation: false,
  blockInspect: false,
  overlayTint: false,
  overlayTintOpacity: 0,
  overlayTintColor: "",
  textureOutlineWidth: 0,
  textureOutlineColor: "",
  textureOutlineOpacity: 0,
  layerMode: "all",
};

// ---- 选区相关 ----

/** 选区点（临时存储，类似土地的 pos1/pos2） */
export interface SelectionPoint {
  x: number;
  y: number;
  z: number;
}

/** 玩家选区状态 */
export interface PlayerSelection {
  pos1: SelectionPoint | null;
  pos2: SelectionPoint | null;
}

// ---- 工具函数 ----

/** 将数据库行对象转为 ProjectionData */
export function rowToProjection(row: ProjectionRow): ProjectionData {
  return {
    id: row.id,
    name: row.name,
    author: row.author ?? "",
    description: row.description ?? "",
    ownerId: row.owner_id,
    isPublic: !!row.is_public,
    visibility: row.visibility as ProjectionVisibility,
    sizeX: row.size_x,
    sizeY: row.size_y,
    sizeZ: row.size_z,
    blockCount: row.block_count,
    structureData: row.structure_data,
    palette: row.palette ?? "",
    blocks: "",
    blockEntities: row.block_entities ?? "",
    settings: {
      scale: row.scale,
      offsetX: row.offset_x,
      offsetY: row.offset_y,
      offsetZ: row.offset_z,
      rotation: row.rotation,
      opacity: row.opacity,
      layer: row.layer ?? 0,
      visible: !!row.visible,
      spawnAnimation: !!row.spawn_animation,
      blockInspect: !!row.block_inspect,
      overlayTint: !!row.overlay_tint,
      overlayTintOpacity: row.overlay_tint_opacity ?? 0,
      overlayTintColor: row.texture_outline_color ?? "",
      textureOutlineWidth: row.texture_outline_width ?? 0,
      textureOutlineColor: row.texture_outline_color ?? "",
      textureOutlineOpacity: row.texture_outline_opacity ?? 0,
      layerMode: (row.layer_mode as LayerMode) ?? "all",
    },
    fromWorld: !!row.from_world,
    dbVersion: row.db_version,
    geometryFile: row.geometry_file,
    materials: [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
