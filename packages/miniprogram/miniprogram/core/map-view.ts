/**
 * map-view.ts — 地图页的视口与瓦片计算（纯函数，不依赖 wx）
 *
 * 使用场景：pages/map 的 canvas 渲染与手势处理：方块坐标与屏幕坐标互换、平移、以手指为中心缩放、
 * 选择瓦片层级、枚举视口内的瓦片、找低一级瓦片占位、区块网格的线距。
 * 瓦片规则移植自 bluemap 网页 web/src/lib/unmined-meta.ts 与 satellite-map.tsx（两个项目暂时各有一份，后续可抽成共享包）。
 * 坐标约定：x 向东增大、z 向南增大；屏幕 x 向右、y 向下，因此方块 z 直接对应屏幕 y。
 */
import type { MapBounds, RenderedMapMeta } from "./map-api";

/**
 * 视口：屏幕中心对准的方块坐标与缩放比例。
 * scale 为每方块对应的 CSS 像素数；层级 z 的瓦片在 scale = 2^z 时按原尺寸显示。
 */
export interface Viewport {
  centerX: number;
  centerZ: number;
  scale: number;
  /** canvas 的 CSS 尺寸 */
  width: number;
  height: number;
}

/** 屏幕上的一个点（CSS 像素） */
export interface ScreenPoint {
  x: number;
  y: number;
}

/** 一张瓦片的坐标 */
export interface TileKey {
  zoom: number;
  tileX: number;
  tileZ: number;
}

/** 视口里的一张瓦片：坐标与它在屏幕上的位置、边长 */
export interface TilePlacement extends TileKey {
  left: number;
  top: number;
  size: number;
}

/** 占位用的祖先瓦片：取它图片里的一块（源矩形，单位为瓦片像素）画到目标瓦片的位置 */
export interface TileFallback extends TileKey {
  srcX: number;
  srcY: number;
  srcSize: number;
}

/**
 * 缩小时允许超出最低层级的级数：最低层级瓦片再缩小一半显示，便于看清全图。
 * 使用场景：scaleLimits。
 */
const ZOOM_OUT_EXTRA_LEVELS = 1;
/**
 * 放大时允许超出最高层级的级数：最高层级瓦片放大 4 倍显示，便于点选玩家与领地边界。
 * 使用场景：scaleLimits。
 */
const ZOOM_IN_EXTRA_LEVELS = 2;

/** 首次进入时整图适配屏幕后再留出的边距比例（地图占屏幕短边的 90%）。使用场景：fitViewport。 */
const FIT_FILL_RATIO = 0.9;

/** 一个区块的边长（方块）。使用场景：区块网格的线距、领地按区块换算方块坐标（core/map-lands.ts）。 */
export const CHUNK_BLOCKS = 16;

/**
 * 区块网格的疏密阈值（CSS 像素），与 bluemap 网页 web/src/lib/map-layers.ts 的 chunkGridStyle 一致：
 * 格子小于 GRID_MIN_CELL_PX 时改为每隔 2、4、8… 个区块画一条，最多合并 GRID_MAX_MERGE 个；合并后仍小于 GRID_HIDE_PX 就不画。
 * 使用场景：chunkGridSpacing。
 */
const GRID_MIN_CELL_PX = 12;
const GRID_MAX_MERGE = 64;
const GRID_HIDE_PX = 8;

/** 某一层级上，一张瓦片覆盖的方块边长 */
export function tileBlockSize(zoom: number, tileSize: number): number {
  return tileSize / 2 ** zoom;
}

/** 视口允许的缩放范围（每方块 CSS 像素） */
export function scaleLimits(meta: RenderedMapMeta): { min: number; max: number } {
  return { min: 2 ** (meta.minZoom - ZOOM_OUT_EXTRA_LEVELS), max: 2 ** (meta.maxZoom + ZOOM_IN_EXTRA_LEVELS) };
}

/** 选择与当前缩放最接近的瓦片层级（与网页版 chooseTileZoom 相同） */
export function chooseTileZoom(scale: number, meta: RenderedMapMeta): number {
  const raw = Math.round(Math.log2(Math.max(scale, 0.0001)));
  return Math.min(meta.maxZoom, Math.max(meta.minZoom, raw));
}

/** 方块坐标 → 屏幕坐标 */
export function blockToScreen(view: Viewport, x: number, z: number): ScreenPoint {
  return { x: (x - view.centerX) * view.scale + view.width / 2, y: (z - view.centerZ) * view.scale + view.height / 2 };
}

/** 屏幕坐标 → 方块坐标（小数） */
export function screenToBlock(view: Viewport, point: ScreenPoint): { x: number; z: number } {
  return { x: view.centerX + (point.x - view.width / 2) / view.scale, z: view.centerZ + (point.y - view.height / 2) / view.scale };
}

/** 把中心点限制在地图边界内，避免拖到一片空白里找不回来 */
export function clampCenter(view: Viewport, bounds: MapBounds): Viewport {
  return {
    ...view,
    centerX: Math.min(bounds.maxX, Math.max(bounds.minX, view.centerX)),
    centerZ: Math.min(bounds.maxZ, Math.max(bounds.minZ, view.centerZ)),
  };
}

/** 平移：手指在屏幕上移动 (dx, dy)，地图跟着移动 */
export function panBy(view: Viewport, dx: number, dy: number): Viewport {
  return { ...view, centerX: view.centerX - dx / view.scale, centerZ: view.centerZ - dy / view.scale };
}

/**
 * 以屏幕上某点为中心缩放到新比例（该点下的方块保持不动），比例限制在 limits 内。
 * 使用场景：双指缩放（以两指中点为中心）与缩放按钮（以屏幕中心为中心）。
 */
export function zoomAt(view: Viewport, nextScale: number, anchor: ScreenPoint, limits: { min: number; max: number }): Viewport {
  const scale = Math.min(limits.max, Math.max(limits.min, nextScale));
  const block = screenToBlock(view, anchor);
  return {
    ...view,
    scale,
    centerX: block.x - (anchor.x - view.width / 2) / scale,
    centerZ: block.z - (anchor.y - view.height / 2) / scale,
  };
}

/** 视口当前覆盖的方块范围 */
export function viewBlockRect(view: Viewport): MapBounds {
  const halfW = view.width / 2 / view.scale;
  const halfH = view.height / 2 / view.scale;
  return { minX: view.centerX - halfW, minZ: view.centerZ - halfH, maxX: view.centerX + halfW, maxZ: view.centerZ + halfH };
}

/**
 * 当前缩放下区块网格线的间距（方块，总是 CHUNK_BLOCKS 的 2 的幂倍）；缩得太小不必画时返回 null。
 * 使用场景：地图页「区块」图层，缩小时自动稀疏，避免网格糊成一片。
 */
export function chunkGridSpacing(scale: number): number | null {
  let cells = 1;
  let cellPx = CHUNK_BLOCKS * scale;
  while (cellPx < GRID_MIN_CELL_PX && cells < GRID_MAX_MERGE) {
    cells *= 2;
    cellPx *= 2;
  }
  return cellPx < GRID_HIDE_PX ? null : cells * CHUNK_BLOCKS;
}

/**
 * 枚举视口盖住、且落在地图边界内的瓦片，按离屏幕中心由近到远排序（先加载中间的）。
 * 使用场景：每帧绘制与按需加载瓦片图片。
 */
export function visibleTiles(view: Viewport, meta: RenderedMapMeta): TilePlacement[] {
  const zoom = chooseTileZoom(view.scale, meta);
  const blocks = tileBlockSize(zoom, meta.tileSize);
  const rect = viewBlockRect(view);
  const minX = Math.max(rect.minX, meta.bounds.minX);
  const minZ = Math.max(rect.minZ, meta.bounds.minZ);
  const maxX = Math.min(rect.maxX, meta.bounds.maxX);
  const maxZ = Math.min(rect.maxZ, meta.bounds.maxZ);
  if (minX >= maxX || minZ >= maxZ) return [];
  const x0 = Math.floor(minX / blocks);
  const x1 = Math.ceil(maxX / blocks) - 1;
  const z0 = Math.floor(minZ / blocks);
  const z1 = Math.ceil(maxZ / blocks) - 1;
  const size = blocks * view.scale;
  const tiles: Array<TilePlacement & { distance: number }> = [];
  for (let tileX = x0; tileX <= x1; tileX += 1) {
    for (let tileZ = z0; tileZ <= z1; tileZ += 1) {
      const origin = blockToScreen(view, tileX * blocks, tileZ * blocks);
      const dx = origin.x + size / 2 - view.width / 2;
      const dy = origin.y + size / 2 - view.height / 2;
      tiles.push({ zoom, tileX, tileZ, left: origin.x, top: origin.y, size, distance: dx * dx + dy * dy });
    }
  }
  tiles.sort((a, b) => a.distance - b.distance);
  return tiles.map(({ distance: _distance, ...tile }) => tile);
}

/**
 * 低 levels 级（覆盖范围更大）的祖先瓦片，以及目标瓦片在它图片里对应的那一块。
 * 使用场景：目标瓦片还没加载完时，用已缓存的低一级瓦片放大占位，避免放大时整屏闪白。
 */
export function ancestorTile(key: TileKey, levels: number, tileSize: number): TileFallback {
  const factor = 2 ** levels;
  const tileX = Math.floor(key.tileX / factor);
  const tileZ = Math.floor(key.tileZ / factor);
  const srcSize = tileSize / factor;
  return {
    zoom: key.zoom - levels,
    tileX,
    tileZ,
    srcX: (key.tileX - tileX * factor) * srcSize,
    srcY: (key.tileZ - tileZ * factor) * srcSize,
    srcSize,
  };
}

/** 瓦片缓存键 */
export function tileKeyString(key: TileKey): string {
  return `${key.zoom}/${key.tileX}/${key.tileZ}`;
}

/**
 * 能完整显示整张地图的视口（留一点边距），中心对准地图中心。
 * 使用场景：首次进入地图页。
 */
export function fitViewport(meta: RenderedMapMeta, width: number, height: number): Viewport {
  const spanX = Math.max(1, meta.bounds.maxX - meta.bounds.minX);
  const spanZ = Math.max(1, meta.bounds.maxZ - meta.bounds.minZ);
  const limits = scaleLimits(meta);
  const fit = Math.min(width / spanX, height / spanZ) * FIT_FILL_RATIO;
  return {
    centerX: meta.centerX,
    centerZ: meta.centerZ,
    scale: Math.min(limits.max, Math.max(limits.min, fit)),
    width,
    height,
  };
}

/**
 * 初始视图：有 uNmINeD 建议的初始层级（defaultZoom）时，以地图中心按该层级原尺寸显示；否则整图适配屏幕。
 * 使用场景：首次进入地图页与「复位」按钮。存档里有很远的零散区块时边界会非常大，整图适配会缩到看不清，所以优先用 defaultZoom。
 */
export function initialViewport(meta: RenderedMapMeta, width: number, height: number): Viewport {
  if (meta.defaultZoom === null) return fitViewport(meta, width, height);
  const limits = scaleLimits(meta);
  return {
    centerX: meta.centerX,
    centerZ: meta.centerZ,
    scale: Math.min(limits.max, Math.max(limits.min, 2 ** meta.defaultZoom)),
    width,
    height,
  };
}

/** 两个触点的距离 */
export function touchDistance(a: ScreenPoint, b: ScreenPoint): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** 两个触点的中点 */
export function touchMidpoint(a: ScreenPoint, b: ScreenPoint): ScreenPoint {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

/**
 * 找出离点击位置最近、且在 radius（CSS 像素）以内的一个点的下标；没有时返回 -1。
 * 使用场景：点击地图上的玩家箭头显示名字与坐标。
 */
export function hitNearest(view: Viewport, points: ReadonlyArray<{ x: number; z: number }>, tap: ScreenPoint, radius: number): number {
  let best = -1;
  let bestDistance = radius * radius;
  points.forEach((point, index) => {
    const screen = blockToScreen(view, point.x, point.z);
    const dx = screen.x - tap.x;
    const dy = screen.y - tap.y;
    const distance = dx * dx + dy * dy;
    if (distance <= bestDistance) {
      best = index;
      bestDistance = distance;
    }
  });
  return best;
}

/** 区域矩形（方块坐标，minX..maxX 与 minZ..maxZ 都含端点，与 bluemap 网页 regionNamesAt 的判断一致） */
export interface BlockRect {
  minX: number;
  minZ: number;
  maxX: number;
  maxZ: number;
}

/**
 * 包含某个方块的区域里面积最小的一个（嵌套时取最里层）；没有时返回 -1。
 * 使用场景：点击地图空白处时显示所在的区域 / 领地名称。
 */
export function smallestRegionAt(regions: readonly BlockRect[], x: number, z: number): number {
  const bx = Math.floor(x);
  const bz = Math.floor(z);
  let best = -1;
  let bestArea = Infinity;
  regions.forEach((region, index) => {
    if (bx < region.minX || bx > region.maxX || bz < region.minZ || bz > region.maxZ) return;
    const area = (region.maxX - region.minX + 1) * (region.maxZ - region.minZ + 1);
    if (area < bestArea) {
      best = index;
      bestArea = area;
    }
  });
  return best;
}

/** 维度 id 是否为主世界（瓦片只覆盖主世界；与网页版 dimensionKind 的判断一致） */
export function isOverworld(dimension: string): boolean {
  return !dimension.endsWith("nether") && !dimension.endsWith("the_end");
}

/** 维度的中文名 */
export function dimensionLabel(dimension: string): string {
  if (dimension.endsWith("nether")) return "下界";
  if (dimension.endsWith("the_end")) return "末地";
  return "主世界";
}
