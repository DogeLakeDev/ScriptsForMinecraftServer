/**
 * map-lands.ts — land 模块领地在地图页上的几何与配色（纯函数，不依赖 wx）
 *
 * 使用场景：pages/map 的「区域与领地」图层按区块画领地填充、外轮廓与子区域虚线框，点击时找出所在领地和子区域。
 * 规则与 bluemap 网页 web/src/lib/lands.ts 一致（配色哈希、只画外轮廓、标签落在最靠近质心的区块），两边改动需同步。
 * 所有坐标都是方块坐标，与视口无关；只在领地数据变化时重算，平移缩放只做坐标换算。瓦片只覆盖主世界，这里只取主世界部分。
 */
import type { MapLand, MapLandArea } from "./map-api";
import { CHUNK_BLOCKS, isOverworld } from "./map-view";

/** 一块领地的配色：fill 半透明填充，stroke 轮廓、子区域虚线与标注（圆点 / 图标 / 大头钉）的底色 */
export interface LandColor {
  fill: string;
  stroke: string;
}

/** 一条外轮廓线段（方块坐标），水平或竖直 */
export interface LandEdge {
  x1: number;
  z1: number;
  x2: number;
  z2: number;
}

/** 方块坐标下的外接矩形，max 不含（区块右下角的下一格） */
export interface LandBounds {
  minX: number;
  minZ: number;
  maxX: number;
  maxZ: number;
}

/** 一块领地在主世界的绘制几何 */
export interface LandShape {
  land: MapLand;
  color: LandColor;
  /** 已占领区块的西北角方块坐标 [x, z]，每个画一个 CHUNK_BLOCKS 见方的格子 */
  chunks: Array<[number, number]>;
  /** 只含外轮廓的线段：相邻两格都属于本领地时，它们之间的边不画；同一直线上首尾相接的已合并 */
  edges: LandEdge[];
  /** 主世界的子区域 */
  areas: MapLandArea[];
  bounds: LandBounds;
  /** 名称标签的位置：离区块质心最近的那个区块的中心，保证落在领地内 */
  labelAt: { x: number; z: number };
  /** 已占领区块键 "chunkX,chunkZ"，用于点击查询 */
  chunkKeys: ReadonlySet<string>;
}

/** 区块键。使用场景：chunkKeys 的存取 */
function chunkKey(chunkX: number, chunkZ: number): string {
  return `${chunkX},${chunkZ}`;
}

/** 领地填充的不透明度（与网页版 hsla 的第四个分量一致）。使用场景：landColor */
const LAND_FILL_ALPHA = 0.28;

/**
 * HSL 换算成 0–255 的 RGB 分量（h 为度数，s、l 为 0–1，CSS 规范的换算公式）。
 * 使用场景：landColor。iOS 微信的 canvas 2d 对 hsla() 填充显示异常（领地变成不透明的黑、白或杂色块，电脑版正常），
 * 所以颜色在这里换算成各端都支持的 rgba() / rgb() 写法；数值与原先的 hsla / hsl 相同，网页版继续用 hsla 不受影响。
 */
function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const a = s * Math.min(l, 1 - l);
  const channel = (n: number) => {
    const k = (n + h / 30) % 12;
    return Math.round((l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))) * 255);
  };
  return [channel(0), channel(8), channel(4)];
}

/**
 * 按领地 id 生成固定的颜色（FNV-1a 哈希取色相）。
 * 使用场景：每块领地一种色相，相邻领地容易分清，刷新数据时颜色不跳；与网页版同一 id 得到同一色相。
 * 色值仍是 hsla(hue, 75%, 50%, 0.28) / hsl(hue, 80%, 40%)，只是写成 rgba / rgb（见 hslToRgb）。
 */
export function landColor(id: string): LandColor {
  let hash = 0x811c9dc5;
  for (let i = 0; i < id.length; i += 1) {
    hash ^= id.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  const hue = (hash >>> 0) % 360;
  const [fr, fg, fb] = hslToRgb(hue, 0.75, 0.5);
  const [sr, sg, sb] = hslToRgb(hue, 0.8, 0.4);
  return { fill: `rgba(${fr}, ${fg}, ${fb}, ${LAND_FILL_ALPHA})`, stroke: `rgb(${sr}, ${sg}, ${sb})` };
}

/**
 * 把同一条直线上首尾相接的单区块线段合并成长线段。
 * lines 的键是线所在的坐标（水平线为 z，竖直线为 x），值是该线上每段的起点（长度均为一个区块）。
 */
function mergeEdges(lines: Map<number, number[]>, horizontal: boolean, out: LandEdge[]): void {
  for (const [line, starts] of lines) {
    starts.sort((a, b) => a - b);
    let runStart = starts[0]!;
    let runEnd = runStart + CHUNK_BLOCKS;
    const flush = () => out.push(horizontal ? { x1: runStart, z1: line, x2: runEnd, z2: line } : { x1: line, z1: runStart, x2: line, z2: runEnd });
    for (let i = 1; i < starts.length; i += 1) {
      if (starts[i] === runEnd) {
        runEnd += CHUNK_BLOCKS;
        continue;
      }
      flush();
      runStart = starts[i]!;
      runEnd = runStart + CHUNK_BLOCKS;
    }
    flush();
  }
}

/** 往某条线上记一段单区块线段 */
function pushSegment(lines: Map<number, number[]>, line: number, start: number): void {
  const list = lines.get(line);
  if (list) list.push(start);
  else lines.set(line, [start]);
}

/** 一块领地在主世界的绘制几何；主世界既没有区块也没有子区域时返回 null */
function buildLandShape(land: MapLand): LandShape | null {
  const chunks: Array<[number, number]> = [];
  for (const group of land.claims) {
    if (isOverworld(group.dimensionId)) chunks.push(...group.chunks);
  }
  const areas = land.areas.filter((area) => isOverworld(area.dimensionId));
  if (chunks.length === 0 && areas.length === 0) return null;

  const chunkKeys = new Set(chunks.map(([x, z]) => chunkKey(x, z)));
  const horizontal = new Map<number, number[]>();
  const vertical = new Map<number, number[]>();
  const bounds: LandBounds = { minX: Infinity, minZ: Infinity, maxX: -Infinity, maxZ: -Infinity };
  const origins: Array<[number, number]> = [];
  let sumX = 0;
  let sumZ = 0;
  for (const [cx, cz] of chunks) {
    const x = cx * CHUNK_BLOCKS;
    const z = cz * CHUNK_BLOCKS;
    origins.push([x, z]);
    if (!chunkKeys.has(chunkKey(cx, cz - 1))) pushSegment(horizontal, z, x);
    if (!chunkKeys.has(chunkKey(cx, cz + 1))) pushSegment(horizontal, z + CHUNK_BLOCKS, x);
    if (!chunkKeys.has(chunkKey(cx - 1, cz))) pushSegment(vertical, x, z);
    if (!chunkKeys.has(chunkKey(cx + 1, cz))) pushSegment(vertical, x + CHUNK_BLOCKS, z);
    bounds.minX = Math.min(bounds.minX, x);
    bounds.minZ = Math.min(bounds.minZ, z);
    bounds.maxX = Math.max(bounds.maxX, x + CHUNK_BLOCKS);
    bounds.maxZ = Math.max(bounds.maxZ, z + CHUNK_BLOCKS);
    sumX += x + CHUNK_BLOCKS / 2;
    sumZ += z + CHUNK_BLOCKS / 2;
  }
  for (const area of areas) {
    bounds.minX = Math.min(bounds.minX, area.minX);
    bounds.minZ = Math.min(bounds.minZ, area.minZ);
    bounds.maxX = Math.max(bounds.maxX, area.maxX + 1);
    bounds.maxZ = Math.max(bounds.maxZ, area.maxZ + 1);
  }

  let labelAt = { x: (bounds.minX + bounds.maxX) / 2, z: (bounds.minZ + bounds.maxZ) / 2 };
  if (origins.length > 0) {
    const meanX = sumX / origins.length;
    const meanZ = sumZ / origins.length;
    let best = Infinity;
    for (const [ox, oz] of origins) {
      const x = ox + CHUNK_BLOCKS / 2;
      const z = oz + CHUNK_BLOCKS / 2;
      const distance = (x - meanX) ** 2 + (z - meanZ) ** 2;
      if (distance < best) {
        best = distance;
        labelAt = { x, z };
      }
    }
  }

  const edges: LandEdge[] = [];
  mergeEdges(horizontal, true, edges);
  mergeEdges(vertical, false, edges);
  return { land, color: landColor(land.id), chunks: origins, edges, areas, bounds, labelAt, chunkKeys };
}

/** 所有领地在主世界的绘制几何。使用场景：地图页拉到领地数据后重算一次 */
export function buildLandShapes(lands: readonly MapLand[]): LandShape[] {
  const out: LandShape[] = [];
  for (const land of lands) {
    const shape = buildLandShape(land);
    if (shape) out.push(shape);
  }
  return out;
}

/** 子区域是否包含这一格（坐标含两端） */
function areaContains(area: MapLandArea, bx: number, bz: number): boolean {
  return bx >= area.minX && bx <= area.maxX && bz >= area.minZ && bz <= area.maxZ;
}

/**
 * 某个方块所在的领地，以及包含它的子区域；没有领地时返回 null。
 * 使用场景：点击地图时的信息卡。先按区块找；区块未被占领但落在某个子区域里时也算该领地（与网页版 landAt 一致）。
 */
export function landAt(shapes: readonly LandShape[], x: number, z: number): { shape: LandShape; areas: MapLandArea[] } | null {
  const bx = Math.floor(x);
  const bz = Math.floor(z);
  const key = chunkKey(Math.floor(bx / CHUNK_BLOCKS), Math.floor(bz / CHUNK_BLOCKS));
  const shape = shapes.find((item) => item.chunkKeys.has(key)) ?? shapes.find((item) => item.areas.some((area) => areaContains(area, bx, bz)));
  if (!shape) return null;
  return { shape, areas: shape.areas.filter((area) => areaContains(area, bx, bz)) };
}

/** 领地状态的中文名；未知状态原样返回。使用场景：信息卡 */
export function landStatusLabel(status: string): string {
  if (status === "active") return "正常";
  if (status === "delinquent") return "欠费";
  if (status === "frozen") return "冻结";
  return status;
}
