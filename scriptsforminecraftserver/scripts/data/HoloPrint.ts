import { Player } from "@minecraft/server";

/** 投影可见性 */
export type ProjectionVisibility = "public" | "private";

/** 层模式 */
export type LayerMode = "all" | "single" | "range";

/** 投影设置（可由玩家调整） */
export interface HoloSettings {
  scale: number;
  offsetX: number;
  offsetY: number;
  offsetZ: number;
  rotation: number;
  opacity: number;
  layer: number;
  visible: boolean;
  spawnAnimation: boolean;
  blockInspect: boolean;
  overlayTint: string;
  overlayTintOpacity: number;
  textureOutlineWidth: number;
  textureOutlineColor: string;
  textureOutlineOpacity: number;
  layerMode: LayerMode;
}

/** 投影数据库记录 */
export interface ProjectionData {
  id: string;
  name: string;
  author: string;
  description: string;
  ownerId: string;
  isPublic: boolean;
  visibility: ProjectionVisibility;
  settings: HoloSettings;
  dbVersion: number;
  geometryFile: string;
  blockCount: number;
  sizeX: number;
  sizeY: number;
  sizeZ: number;
  materials: BlockMaterial[];
  createdAt: number;
  updatedAt: number;
}

/** 方块材料统计 */
export interface BlockMaterial {
  name: string;
  count: number;
}

/** 数据库源数据（从 API 返回的原始行） */
export interface ProjectionRow {
  id: string;
  name: string;
  author: string;
  description: string;
  owner_id: string;
  is_public: number;
  visibility: string;
  scale: number;
  offset_x: number;
  offset_y: number;
  offset_z: number;
  rotation: number;
  opacity: number;
  layer: number;
  visible: number;
  spawn_animation: number;
  block_inspect: number;
  overlay_tint: string;
  overlay_tint_opacity: number;
  texture_outline_width: number;
  texture_outline_color: string;
  texture_outline_opacity: number;
  layer_mode: string;
  db_version: number;
  geometry_file: string;
  block_count: number;
  size_x: number;
  size_y: number;
  size_z: number;
  created_at: number;
  updated_at: number;
}

/** 颜色预设 */
export interface ColorPreset {
  name: string;
  value: string;
  hex: string;
}

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
  overlayTint: "",
  overlayTintOpacity: 0,
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
    author: row.author,
    description: row.description,
    ownerId: row.owner_id,
    isPublic: !!row.is_public,
    visibility: row.visibility as ProjectionVisibility,
    settings: {
      scale: row.scale,
      offsetX: row.offset_x,
      offsetY: row.offset_y,
      offsetZ: row.offset_z,
      rotation: row.rotation,
      opacity: row.opacity,
      layer: row.layer,
      visible: !!row.visible,
      spawnAnimation: !!row.spawn_animation,
      blockInspect: !!row.block_inspect,
      overlayTint: row.overlay_tint,
      overlayTintOpacity: row.overlay_tint_opacity,
      textureOutlineWidth: row.texture_outline_width,
      textureOutlineColor: row.texture_outline_color,
      textureOutlineOpacity: row.texture_outline_opacity,
      layerMode: row.layer_mode as LayerMode,
    },
    dbVersion: row.db_version,
    geometryFile: row.geometry_file,
    blockCount: row.block_count,
    sizeX: row.size_x,
    sizeY: row.size_y,
    sizeZ: row.size_z,
    materials: [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
