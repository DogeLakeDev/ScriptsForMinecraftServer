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
  overlayTint: boolean;
  overlayTintOpacity: number;
  overlayTintColor: string;
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
  structureData: string;
  palette: string;
  blocks: string;
  blockEntities: string;
  fromWorld: boolean;
  dimension?: string;
  posX?: number;
  posY?: number;
  posZ?: number;
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
  structure_data: string;
  palette: string;
  block_entities: string;
  from_world: number;
  created_at: number;
  updated_at: number;
}

/** 颜色预设 */
export interface ColorPreset {
  name: string;
  value: string;
  hex: string;
}
