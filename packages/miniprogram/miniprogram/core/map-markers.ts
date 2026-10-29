/**
 * map-markers.ts — 地图标注的避让排版与点击命中（纯函数，不依赖 wx / canvas）
 *
 * 使用场景：pages/map 给每块领地画 Apple 地图式的标注——放得下时画圆形图标 + 名称，与已放下的图标重叠时退化成小圆点，
 * 选中的领地画成大头钉；这样缩得再小也能看到哪里有领地。
 * 这里只按屏幕坐标决定每个标注画成什么、名称写不写，以及点击落在哪个标注上；绘制与尺寸常量在 pages/map/map.ts。
 */

/** 一个待排版的标注：锚点为屏幕坐标（CSS 像素） */
export interface MarkerInput {
  id: string;
  x: number;
  y: number;
  /** 名称文字的宽度（px），由调用方用画布测量；0 表示不写名称 */
  labelWidth: number;
}

/** 标注的形态：dot 小圆点；icon 圆形图标；pin 选中对象的大头钉 */
export type MarkerKind = "dot" | "icon" | "pin";

/** 一个标注的排版结果 */
export interface MarkerPlacement {
  id: string;
  /** 在 inputs 里的下标，调用方据此找回自己的数据 */
  index: number;
  x: number;
  y: number;
  kind: MarkerKind;
  /** 是否在下方写名称（pin 总是写；icon 在名称不与其他标注重叠时写；dot 不写） */
  showLabel: boolean;
}

/** 排版与命中用的尺寸（px），须与绘制尺寸一致 */
export interface MarkerMetrics {
  /** 圆形图标半径 */
  iconRadius: number;
  /** 大头钉圆头半径，以及圆头中心在锚点上方的距离 */
  pinRadius: number;
  pinHeight: number;
  /** 名称顶边到图标底边（大头钉为锚点）的距离，以及名称的行高 */
  labelGap: number;
  labelHeight: number;
  /** 图标之间、图标与名称之间至少留出的间距 */
  padding: number;
  /** 点击图标 / 大头钉时在半径外额外放宽的距离 */
  hitSlop: number;
  /** 点击小圆点的命中半径（小圆点很小，按手指大小放宽） */
  dotHitRadius: number;
}

/** 屏幕上的矩形（含边界） */
interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** 两个矩形是否相交。使用场景：layoutMarkers 的避让判断 */
function intersects(a: Box, b: Box): boolean {
  return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
}

/** 矩形是否与已占用的任一矩形相交 */
function collides(box: Box, taken: readonly Box[]): boolean {
  return taken.some((item) => intersects(box, item));
}

/** 名称所占的矩形：水平居中于锚点，顶边在 top */
function labelBox(x: number, top: number, width: number, metrics: MarkerMetrics): Box {
  const half = width / 2 + metrics.padding;
  return { left: x - half, top, right: x + half, bottom: top + metrics.labelHeight + metrics.padding };
}

/**
 * 贪心避让排版：选中对象先放大头钉（连同名称），其余按 inputs 的顺序（调用方按重要程度排好）依次尝试放圆形图标，
 * 与已放下的图标 / 大头钉 / 名称重叠的退化成小圆点（小圆点允许互相重叠、不参与避让）；图标放下后再尝试写名称。
 * 顺序固定时结果只取决于屏幕位置，平移缩放时同一位置的标注不会来回跳。
 * 使用场景：pages/map 每帧画领地标注前调用，结果同时留作点击命中（markerAt）。
 */
export function layoutMarkers(inputs: readonly MarkerInput[], selectedId: string | null, metrics: MarkerMetrics): MarkerPlacement[] {
  const taken: Box[] = [];
  const out: MarkerPlacement[] = [];
  const selectedIndex = selectedId === null ? -1 : inputs.findIndex((input) => input.id === selectedId);
  if (selectedIndex >= 0) {
    const pin = inputs[selectedIndex]!;
    const half = metrics.pinRadius + metrics.padding;
    taken.push({ left: pin.x - half, top: pin.y - metrics.pinHeight - half, right: pin.x + half, bottom: pin.y });
    if (pin.labelWidth > 0) taken.push(labelBox(pin.x, pin.y + metrics.labelGap, pin.labelWidth, metrics));
    out.push({ id: pin.id, index: selectedIndex, x: pin.x, y: pin.y, kind: "pin", showLabel: pin.labelWidth > 0 });
  }
  const reach = metrics.iconRadius + metrics.padding;
  inputs.forEach((input, index) => {
    if (index === selectedIndex) return;
    const icon: Box = { left: input.x - reach, top: input.y - reach, right: input.x + reach, bottom: input.y + reach };
    if (collides(icon, taken)) {
      out.push({ id: input.id, index, x: input.x, y: input.y, kind: "dot", showLabel: false });
      return;
    }
    // 名称紧贴自己的图标，只与其他标注比较，所以先判断名称再登记图标
    let showLabel = false;
    if (input.labelWidth > 0) {
      const label = labelBox(input.x, input.y + metrics.iconRadius + metrics.labelGap, input.labelWidth, metrics);
      if (!collides(label, taken)) {
        taken.push(label);
        showLabel = true;
      }
    }
    taken.push(icon);
    out.push({ id: input.id, index, x: input.x, y: input.y, kind: "icon", showLabel });
  });
  return out;
}

/** 绘制层次：大头钉在最上，其次图标，小圆点在最下；点击时按这个顺序优先命中 */
const KIND_LAYER: Record<MarkerKind, number> = { pin: 2, icon: 1, dot: 0 };

/**
 * 点击落在哪个标注上：取命中范围内层次最高的，同层取离点击处最近的；都没命中时返回 null。
 * 命中范围：大头钉为圆头（加 hitSlop）或锚点附近，图标为半径加 hitSlop，小圆点为 dotHitRadius。
 * 使用场景：pages/map 的 handleTap，在按区块查找领地之前先查标注（缩小后点小圆点也能选中领地）。
 */
export function markerAt(placements: readonly MarkerPlacement[], point: { x: number; y: number }, metrics: MarkerMetrics): MarkerPlacement | null {
  let best: MarkerPlacement | null = null;
  let bestDistance = Infinity;
  for (const placement of placements) {
    let distance: number;
    if (placement.kind === "pin") {
      const head = Math.hypot(point.x - placement.x, point.y - (placement.y - metrics.pinHeight));
      const anchor = Math.hypot(point.x - placement.x, point.y - placement.y);
      distance = Math.min(head <= metrics.pinRadius + metrics.hitSlop ? head : Infinity, anchor <= metrics.dotHitRadius ? anchor : Infinity);
    } else {
      const radius = placement.kind === "icon" ? metrics.iconRadius + metrics.hitSlop : metrics.dotHitRadius;
      const d = Math.hypot(point.x - placement.x, point.y - placement.y);
      distance = d <= radius ? d : Infinity;
    }
    if (distance === Infinity) continue;
    const layer = KIND_LAYER[placement.kind];
    const bestLayer = best ? KIND_LAYER[best.kind] : -1;
    if (layer > bestLayer || (layer === bestLayer && distance < bestDistance)) {
      best = placement;
      bestDistance = distance;
    }
  }
  return best;
}
