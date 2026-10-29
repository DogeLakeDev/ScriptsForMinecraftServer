/**
 * map — 玩家端「地图」
 *
 * 使用场景：查看服务器主世界的俯视地图（bluemap / uNmINeD 渲染的瓦片）、所有在线玩家的位置，以及区域与领地范围。
 * 版式参考 Apple 地图 / 「查找」：地图铺满，右下角面板顶边上方一个玻璃胶囊（图层、定位到我，随面板升降，iOS 26 地图的位置），
 * 其余信息都在底部可拖动面板（components/map-sheet）里。
 * - canvas 2d 原生绘制：单指拖动、双指缩放（没有缩放按钮），缩放时左上角短暂显示比例尺，用 canvas.requestAnimationFrame 按需重绘；
 * - 瓦片走 core/tile-cache.ts 的 LRU 缓存，目标层级还没加载完时用已缓存的低一级瓦片放大占位；
 * - 面板三种内容：列表（搜索框 + 在线玩家 / 其他维度 / 区域与领地）、地点卡（选中对象的标题、操作按钮与详情）、图层开关；
 * - 玩家画成首字母头像气泡，自己画成蓝点加朝向光锥；点击玩家、领地（含子区域）或区域打开地点卡，点击空白处关闭；
 * - 玩家、区域、领地、区块网格四个图层可在图层面板里开关，「回到全图」也在那里；
 * - 领地来自 land 模块（…/map/lands，按区块画填充、外轮廓与子区域虚线框，几何在 core/map-lands.ts），
 *   每块领地另有 Apple 地图式标注：放得下时为圆形图标 + 名称，放不下时为小圆点，选中时为大头钉（避让排版在 core/map-markers.ts），
 *   缩得再小也能看到哪里有领地；
 *   区域来自 area 模块（…/map/regions，矩形）；
 * - 不在主世界的玩家列在面板的「其他维度」分组，不画在图上（瓦片只覆盖主世界）；
 * - 已绑定游戏账号时显示「定位到我」，按游戏角色名匹配自己的位置，列表里的玩家按与自己的距离排序；
 * - 页面显示时每 5 秒刷新玩家位置，隐藏时停止；元数据、区域与领地在每次进入页面时拉取。
 * 数据来自 core/map-api.ts（mp-gateway 只读转发），视口与瓦片计算在 core/map-view.ts。
 */
import type { SheetDetent, SheetLayoutDetail } from "../../components/map-sheet/index";
import { errorText, hashHue } from "../../core/format";
import { homeMapApi, renderedMeta, type MapLand, type MapPlayer, type MapRegion, type RenderedMapMeta } from "../../core/map-api";
import { buildLandShapes, landAt, landStatusLabel, type LandShape } from "../../core/map-lands";
import { layoutMarkers, markerAt, type MarkerInput, type MarkerMetrics, type MarkerPlacement } from "../../core/map-markers";
import {
  ancestorTile,
  blockToScreen,
  CHUNK_BLOCKS,
  chooseTileZoom,
  chunkGridSpacing,
  clampCenter,
  dimensionLabel,
  hitNearest,
  initialViewport,
  isOverworld,
  panBy,
  scaleLimits,
  screenToBlock,
  smallestRegionAt,
  tileKeyString,
  touchDistance,
  touchMidpoint,
  viewBlockRect,
  visibleTiles,
  zoomAt,
  type ScreenPoint,
  type Viewport,
} from "../../core/map-view";
import { paletteColor } from "../../core/palette";
import { homePlayerApi } from "../../core/player-api";
import { selectPlayerTab } from "../../core/player-tabs";
import { hasHomeServer } from "../../core/server";
import { TileCache } from "../../core/tile-cache";

/** 页面显示期间刷新玩家位置的间隔 */
const PLAYER_POLL_MS = 5000;
/** 瓦片缓存上限（张）。一屏约 10–30 张，留出来回拖动与相邻层级占位的余量 */
const TILE_CACHE_LIMIT = 160;
/** 同时加载的瓦片数 */
const TILE_PARALLEL = 6;
/** 瓦片加载失败（多为该处没有地形）后多久才重试 */
const TILE_RETRY_MS = 60_000;
/** 瓦片缓存的最长保留时间：再次进入页面时超过这个时间就清空，换上服务器定时重新渲染后的新图 */
const TILE_CACHE_MAX_AGE_MS = 10 * 60_000;
/** 占位时最多向上找几级已缓存的低层级瓦片 */
const FALLBACK_LEVELS = 3;
/** 手指移动不超过这个距离（CSS 像素）且按下时间够短才算点击 */
const TAP_SLOP_PX = 8;
const TAP_MAX_MS = 350;
/** 点击玩家标注的命中半径（CSS 像素） */
const PLAYER_HIT_RADIUS = 24;
/** 「定位到我」时至少放大到每方块的像素数，便于看清周围 */
const LOCATE_MIN_SCALE = 2;
/** 其他玩家头像气泡的半径（CSS 像素）；选中时加大到 PLAYER_BUBBLE_SELECTED_RADIUS。使用场景：drawPlayer */
const PLAYER_BUBBLE_RADIUS = 12;
const PLAYER_BUBBLE_SELECTED_RADIUS = 15;
/** 头像气泡的底色饱和度 / 亮度，与名单页 .avatar 的 hsl(hue, 55%, 62%) 一致，列表与地图上同一玩家同色 */
const PLAYER_BUBBLE_SL = "55%, 62%";
/** 自己的位置蓝点半径与朝向光锥（半径、半张角，CSS 像素 / 度）。使用场景：drawSelf */
const SELF_DOT_RADIUS = 7;
const SELF_CONE_RADIUS = 44;
const SELF_CONE_HALF_ANGLE = 32;
/** 地图移到目标（定位、点选列表项、跟随）的动画时长（ms）。使用场景：flyTo */
const FLY_MS = 350;
/** 按范围定位区域 / 领地时，范围占可见区域的比例，四周留出余量。使用场景：focusBounds */
const FIT_BOUNDS_RATIO = 0.7;
/** 面板上方可见区域的最小高度（CSS 像素）：面板拉到全屏时仍按这个高度计算目标位置。使用场景：visibleHeight */
const MIN_VISIBLE_PX = 160;
/** 比例尺：缩放停止后保留的时长（ms）与最大长度（CSS 像素）。使用场景：drawScaleBar */
const SCALE_BAR_SHOW_MS = 1500;
const SCALE_BAR_MAX_PX = 96;
/** 比例尺距画布左上角的位置；上报中断提示条显示时下移，让出提示条。使用场景：drawScaleBar */
const SCALE_BAR_LEFT = 16;
const SCALE_BAR_TOP = 20;
const SCALE_BAR_TOP_WITH_BADGE = 52;
/** 区域在屏幕上至少这么宽（CSS 像素）才写名称，避免小领地的字糊成一团 */
const REGION_LABEL_MIN_PX = 48;
/** 领地子区域虚线框的线段 / 间隔长度（CSS 像素）。使用场景：drawLands */
const LAND_AREA_DASH = [4, 3];
/** 地图文字的默认字体（drawLabel），以及大头钉下方名称的加粗字体。使用场景：drawLabel、drawLandMarkers */
const LABEL_FONT = "12px sans-serif";
const PIN_LABEL_FONT = "600 13px sans-serif";
/** 领地小圆点的半径（CSS 像素）。使用场景：drawLandMarkers */
const LAND_DOT_RADIUS = 4;
/** 领地标注的排版与命中尺寸（CSS 像素，各项含义见 MarkerMetrics），绘制也按这里的尺寸。使用场景：drawLandMarkers、handleTap */
const LAND_MARKER_METRICS: MarkerMetrics = {
  iconRadius: 11,
  pinRadius: 17,
  pinHeight: 32,
  labelGap: 3,
  labelHeight: 14,
  padding: 4,
  hitSlop: 6,
  dotHitRadius: 12,
};
/** 选中领地时大头钉弹出动画的时长（ms）。使用场景：drawLandPin */
const LAND_PIN_POP_MS = 220;

/**
 * 画布配色。canvas 读不到 CSS 变量，按系统主题取两套。
 * bg 取色板的 --c-bg（与 theme.json 的 pageBg 一致，构建时核对），是地图边界外的底色；玩家与区域颜色叠在地形上，需要描边保证对比度。
 * self / selfCone 为自己的蓝点与朝向光锥（iOS 系统蓝，Apple 地图「我的位置」同色）；其他玩家的气泡按名字取色（PLAYER_BUBBLE_SL）。
 * grid / gridHighlight 是区块网格的暗线与错开 1 像素的亮线，深浅地形上都能看清（与 bluemap 网页 chunkGridStyle 同色）。
 * land 模块的领地按 id 取色（core/map-lands.ts 的 landColor），不在这里。
 */
const MAP_COLORS = {
  light: { bg: paletteColor("--c-bg", "light"), self: "#007aff", selfCone: "rgba(0,122,255,0.35)", outline: "#ffffff", bubbleText: "#ffffff", label: "#1c1c1c", labelHalo: "rgba(255,255,255,0.85)", area: "rgba(37,99,235,0.95)", areaFill: "rgba(37,99,235,0.10)", land: "rgba(22,163,74,0.95)", landFill: "rgba(22,163,74,0.12)", selected: "#facc15", grid: "rgba(0,0,0,0.55)", gridHighlight: "rgba(255,255,255,0.65)" },
  dark: { bg: paletteColor("--c-bg", "dark"), self: "#0a84ff", selfCone: "rgba(10,132,255,0.4)", outline: "#ffffff", bubbleText: "#ffffff", label: "#f2f2f2", labelHalo: "rgba(0,0,0,0.75)", area: "rgba(96,165,250,0.95)", areaFill: "rgba(96,165,250,0.12)", land: "rgba(74,222,128,0.95)", landFill: "rgba(74,222,128,0.14)", selected: "#facc15", grid: "rgba(0,0,0,0.55)", gridHighlight: "rgba(255,255,255,0.65)" },
};

/** 地图页用到的 canvas 2d 上下文 */
type Context2D = WechatMiniprogram.CanvasRenderingContext.CanvasRenderingContext2D;

/**
 * 当前选中的对象：玩家按名字跟踪（位置会刷新），区域按 id；
 * 领地按 id，并记下点击处所在的子区域 id（信息卡列出子区域名）
 */
type Selection = { kind: "player"; name: string } | { kind: "region"; id: string } | { kind: "land"; id: string; areaIds: string[] } | null;

/** 一次手势的跟踪状态 */
interface Gesture {
  /** 上一帧的触点（1 个为拖动，2 个为缩放） */
  points: ScreenPoint[];
  /** 本次按下的起点与时间，用于判断是否为点击 */
  start: ScreenPoint | null;
  startAt: number;
  /** 本次手势是否出现过移动或多指，出现过就不再当作点击 */
  moved: boolean;
}

/**
 * 页面运行时状态。不放进 data，避免拖动时频繁 setData；标签页实例常驻，用模块级变量保存（与 me.ts 的计时器做法一致）。
 */
const rt = {
  canvas: null as WechatMiniprogram.Canvas | null,
  ctx: null as Context2D | null,
  dpr: 1,
  view: null as Viewport | null,
  meta: null as RenderedMapMeta | null,
  players: [] as MapPlayer[],
  regions: [] as MapRegion[],
  /** land 模块领地的主世界绘制几何（每次进入页面拉取后重算） */
  landShapes: [] as LandShape[],
  /** 领地标注的避让顺序：区块多的在前，先占到图标位置（与 landShapes 同时重算） */
  landMarkerOrder: [] as LandShape[],
  /** 上一帧的领地标注排版，点击时用来命中标注；领地图层关闭时不参与命中 */
  landMarkers: [] as MarkerPlacement[],
  /** 标注名称的宽度缓存（键为 字体 + 名称），避免每帧对几百个名称调用 measureText；领地数据重算时清空 */
  labelWidths: new Map<string, number>(),
  /** 大头钉弹出动画：选中的领地 id 与开始时刻（Date.now()） */
  pinPop: null as { id: string; startAt: number } | null,
  tiles: null as TileCache<WechatMiniprogram.Image> | null,
  tilesCreatedAt: 0,
  /** 已排队的动画帧；非 null 时不重复请求 */
  frame: null as number | null,
  gesture: { points: [], start: null, startAt: 0, moved: false } as Gesture,
  poll: null as number | null,
  /** 当前微信绑定的游戏角色名；未绑定为空 */
  myName: "",
  selection: null as Selection,
  /** 图层开关（与 data.showPlayers / showRegions / showLands / showChunks 同步，绘制时读这里，免得每帧读页面实例） */
  showPlayers: true,
  /** area 模块的区域 */
  showRegions: true,
  /** land 模块的领地（原先与区域共用一个开关，图层面板里拆开） */
  showLands: true,
  /** 区块网格默认关闭（与网页版一致），放大看领地边界时再打开 */
  showChunks: false,
  /** 丢弃过期的加载结果（快速切换标签页时旧请求晚到） */
  loadTicket: 0,
  /** 「飞到目标」动画的序号：每次新动画或手指按下时加一，旧动画看到序号变化就停止 */
  flight: 0,
  /** 跟随选中的玩家：每次刷新位置后把地图移到他那里；手指拖动地图或改选其他对象时取消 */
  following: false,
  /** 底部面板顶边的 y（CSS 像素，与画布坐标一致，画布从页面顶部开始）；面板测量前为 0，按整张画布可见处理 */
  sheetTop: 0,
  /** 面板换档后才执行的定位（换档前面板顶边未知）；由 onSheetLayout 取出执行 */
  pendingFocus: null as (() => void) | null,
  /** 比例尺显示到的时刻（Date.now()）；缩放时延长 */
  scaleBarUntil: 0,
  /** 比例尺到时后重绘一次以隐藏它 */
  scaleBarTimer: null as number | null,
  /** 位置上报已中断（显示提示条时比例尺下移） */
  stale: false,
  /** 面板搜索框的关键词（原样保存，过滤时转小写） */
  query: "",
  /**
   * 从「我的领地」经 switchTab 传来的聚焦领地 id（存储键 mapFocusLandId）。
   * onShow 读出后暂存于此，等 load() 拉完领地再 select；空串表示无待聚焦。
   */
  pendingLandFocus: "",
};

/** 一套画布配色 */
type Palette = (typeof MAP_COLORS)["light"];

/** 当前主题的画布配色（每帧取一次） */
function colors(): Palette {
  return wx.getAppBaseInfo().theme === "dark" ? MAP_COLORS.dark : MAP_COLORS.light;
}

/** 释放画布相关状态。使用场景：地图从“可显示”变为未渲染 / 出错时，画布节点随 wx:if 销毁 */
function releaseCanvas(): void {
  rt.canvas = null;
  rt.ctx = null;
  rt.frame = null;
  rt.tiles = null;
}

/** 主题切换时重绘（onLoad 注册、onUnload 注销，需要同一个函数引用） */
const onTheme = () => requestDraw();

/** 从触摸事件取出 canvas 坐标系下的触点 */
function canvasTouches(event: WechatMiniprogram.TouchCanvas): ScreenPoint[] {
  return (event.touches ?? []).map((touch) => ({ x: touch.x, y: touch.y }));
}

/** 是否为当前绑定的自己（游戏角色名比较不区分大小写，与 Xbox 玩家代号一致） */
function isMe(name: string): boolean {
  return Boolean(rt.myName) && name.toLowerCase() === rt.myName.toLowerCase();
}

/** 区域显示用的种类名 */
function regionKindLabel(kind: MapRegion["kind"]): string {
  return kind === "land" ? "领地" : "区域";
}

/** 请求下一帧重绘；同一帧内多次请求只画一次 */
function requestDraw(): void {
  const canvas = rt.canvas;
  if (!canvas || rt.frame !== null) return;
  rt.frame = canvas.requestAnimationFrame(() => {
    rt.frame = null;
    draw();
  });
}

/** 玩家名的首字母（头像气泡与列表头像共用） */
function initialOf(name: string): string {
  return name.slice(0, 1).toUpperCase();
}

/**
 * 画一名其他玩家：按名字取色的首字母头像气泡（白描边），名字写在下方；选中时气泡加大、描边换成选中色。
 * 自己的位置不走这里，见 drawSelf。
 */
function drawPlayer(ctx: Context2D, palette: Palette, view: Viewport, player: MapPlayer, selected: boolean): void {
  const point = blockToScreen(view, player.x, player.z);
  if (point.x < -40 || point.y < -40 || point.x > view.width + 40 || point.y > view.height + 40) return;
  const radius = selected ? PLAYER_BUBBLE_SELECTED_RADIUS : PLAYER_BUBBLE_RADIUS;
  ctx.beginPath();
  ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
  ctx.fillStyle = `hsl(${hashHue(player.name)}, ${PLAYER_BUBBLE_SL})`;
  ctx.fill();
  ctx.strokeStyle = selected ? palette.selected : palette.outline;
  ctx.lineWidth = selected ? 3 : 2.5;
  ctx.stroke();
  ctx.font = `600 ${Math.round(radius * 0.95)}px sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = palette.bubbleText;
  ctx.fillText(initialOf(player.name), point.x, point.y + 0.5);
  drawLabel(ctx, palette, player.name, point.x, point.y + radius + 12, "center");
}

/**
 * 画自己的位置：蓝点 + 白描边，外加指向朝向的渐隐光锥（Apple 地图「我的位置」）。
 * yaw 0 朝南，光锥默认朝上（北），所以旋转 yaw + 180 度（与原先玩家箭头、网页版一致）；选中时描边换成选中色。
 */
function drawSelf(ctx: Context2D, palette: Palette, view: Viewport, player: MapPlayer, selected: boolean): void {
  const point = blockToScreen(view, player.x, player.z);
  if (point.x < -SELF_CONE_RADIUS || point.y < -SELF_CONE_RADIUS || point.x > view.width + SELF_CONE_RADIUS || point.y > view.height + SELF_CONE_RADIUS) return;
  ctx.save();
  ctx.translate(point.x, point.y);
  ctx.rotate(((player.yaw + 180) * Math.PI) / 180);
  const half = (SELF_CONE_HALF_ANGLE * Math.PI) / 180;
  const gradient = ctx.createRadialGradient(0, 0, SELF_DOT_RADIUS, 0, 0, SELF_CONE_RADIUS);
  gradient.addColorStop(0, palette.selfCone);
  gradient.addColorStop(1, "rgba(0,0,0,0)");
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.arc(0, 0, SELF_CONE_RADIUS, -Math.PI / 2 - half, -Math.PI / 2 + half);
  ctx.closePath();
  ctx.fillStyle = gradient;
  ctx.fill();
  ctx.restore();
  ctx.beginPath();
  ctx.arc(point.x, point.y, SELF_DOT_RADIUS, 0, Math.PI * 2);
  ctx.fillStyle = palette.self;
  ctx.fill();
  ctx.strokeStyle = selected ? palette.selected : palette.outline;
  ctx.lineWidth = 3;
  ctx.stroke();
}

/**
 * 比例尺的长度：取不超过 SCALE_BAR_MAX_PX 的 1 / 2 / 5 × 10ⁿ 格，返回格数与对应的像素长度。
 * 使用场景：drawScaleBar。
 */
function scaleBarSpec(scale: number): { blocks: number; px: number } {
  const maxBlocks = SCALE_BAR_MAX_PX / scale;
  const power = 10 ** Math.floor(Math.log10(Math.max(maxBlocks, 1)));
  let blocks = power;
  for (const step of [5, 2, 1]) {
    if (step * power <= maxBlocks) {
      blocks = step * power;
      break;
    }
  }
  return { blocks, px: blocks * scale };
}

/**
 * 画左上角的比例尺（「N 格」+ 带端点刻度的横线，描边光晕压在地形上也能看清）。
 * 使用场景：双指缩放时显示，停止缩放 SCALE_BAR_SHOW_MS 后隐藏（Apple 地图的做法）。
 */
function drawScaleBar(ctx: Context2D, palette: Palette, view: Viewport): void {
  if (Date.now() >= rt.scaleBarUntil) return;
  const { blocks, px } = scaleBarSpec(view.scale);
  const left = SCALE_BAR_LEFT;
  const top = rt.stale ? SCALE_BAR_TOP_WITH_BADGE : SCALE_BAR_TOP;
  const lineY = top + 12;
  drawLabel(ctx, palette, `${blocks} 格`, left, top, "left");
  ctx.beginPath();
  ctx.moveTo(left, lineY - 4);
  ctx.lineTo(left, lineY);
  ctx.lineTo(left + px, lineY);
  ctx.lineTo(left + px, lineY - 4);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.strokeStyle = palette.labelHalo;
  ctx.lineWidth = 5;
  ctx.stroke();
  ctx.strokeStyle = palette.label;
  ctx.lineWidth = 2;
  ctx.stroke();
}

/** 带描边光晕的文字，压在地形上也能看清；font 默认 LABEL_FONT（大头钉名称传入加粗字体） */
function drawLabel(ctx: Context2D, palette: Palette, text: string, x: number, y: number, align: "center" | "left", font = LABEL_FONT): void {
  ctx.font = font;
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  ctx.lineWidth = 3;
  ctx.lineJoin = "round";
  ctx.strokeStyle = palette.labelHalo;
  ctx.strokeText(text, x, y);
  ctx.fillStyle = palette.label;
  ctx.fillText(text, x, y);
}

/** 画瓦片层：已加载的直接画，没加载完的用已缓存的低层级瓦片放大占位，并按离中心由近到远排队加载 */
function drawTiles(ctx: Context2D, view: Viewport, meta: RenderedMapMeta): void {
  const tiles = rt.tiles;
  if (!tiles) return;
  const visible = visibleTiles(view, meta);
  const zoom = chooseTileZoom(view.scale, meta);
  // 放大超过瓦片原生比例时关闭平滑，方块边缘保持清晰；缩小时保留平滑避免锯齿
  ctx.imageSmoothingEnabled = view.scale < 2 ** zoom;
  const api = homeMapApi();
  const keep = new Set<string>();
  const wanted: Array<{ key: string; url: string }> = [];
  for (const tile of visible) {
    const key = tileKeyString(tile);
    keep.add(key);
    // 取整到像素，避免相邻瓦片之间出现细缝
    const left = Math.floor(tile.left);
    const top = Math.floor(tile.top);
    const width = Math.floor(tile.left + tile.size) - left;
    const height = Math.floor(tile.top + tile.size) - top;
    const image = tiles.get(key);
    if (image) {
      ctx.drawImage(image, left, top, width, height);
      continue;
    }
    wanted.push({ key, url: api.tileUrl(tile.zoom, tile.tileX, tile.tileZ, meta.imageFormat) });
    for (let levels = 1; levels <= FALLBACK_LEVELS && tile.zoom - levels >= meta.minZoom; levels += 1) {
      const parent = ancestorTile(tile, levels, meta.tileSize);
      const parentImage = tiles.get(tileKeyString(parent));
      if (!parentImage) continue;
      keep.add(tileKeyString(parent));
      ctx.drawImage(parentImage, parent.srcX, parent.srcY, parent.srcSize, parent.srcSize, left, top, width, height);
      break;
    }
  }
  tiles.request(wanted);
  tiles.prune(keep);
}

/** 画区域与领地边框；屏幕上足够宽时在左上角写名称 */
function drawRegions(ctx: Context2D, palette: Palette, view: Viewport): void {
  for (const region of rt.regions) {
    if (!isOverworld(region.dimension)) continue;
    const topLeft = blockToScreen(view, region.minX, region.minZ);
    const bottomRight = blockToScreen(view, region.maxX + 1, region.maxZ + 1);
    const width = bottomRight.x - topLeft.x;
    const height = bottomRight.y - topLeft.y;
    if (bottomRight.x < 0 || bottomRight.y < 0 || topLeft.x > view.width || topLeft.y > view.height) continue;
    const selected = rt.selection?.kind === "region" && rt.selection.id === region.id;
    ctx.fillStyle = region.kind === "land" ? palette.landFill : palette.areaFill;
    ctx.fillRect(topLeft.x, topLeft.y, width, height);
    ctx.strokeStyle = selected ? palette.selected : region.kind === "land" ? palette.land : palette.area;
    ctx.lineWidth = selected ? 3 : 1.5;
    ctx.strokeRect(topLeft.x, topLeft.y, width, height);
    if (width >= REGION_LABEL_MIN_PX && height >= 20) drawLabel(ctx, palette, region.name, Math.max(topLeft.x, 0) + 6, Math.max(topLeft.y, 0) + 12, "left");
  }
}

/**
 * 画 land 模块的领地：按区块半透明填充、只描外轮廓，子区域画虚线框，子区域足够宽时在左上角写子区域名。
 * 领地名不再写在这里，改由 drawLandMarkers 的标注（图标 / 大头钉下方）显示，缩小后也不会糊成一团。
 * 使用场景：「领地」图层打开时，画在 area 矩形之上、领地标注之下。
 */
function drawLands(ctx: Context2D, palette: Palette, view: Viewport): void {
  const rect = viewBlockRect(view);
  const cell = CHUNK_BLOCKS * view.scale;
  for (const shape of rt.landShapes) {
    const { bounds } = shape;
    if (bounds.maxX < rect.minX || bounds.minX > rect.maxX || bounds.maxZ < rect.minZ || bounds.minZ > rect.maxZ) continue;
    const selected = rt.selection?.kind === "land" && rt.selection.id === shape.land.id;
    // 同一路径内的格子同向，按非零规则合并填充，相邻区块之间不会出现深色缝
    ctx.beginPath();
    for (const [x, z] of shape.chunks) {
      const origin = blockToScreen(view, x, z);
      ctx.rect(origin.x, origin.y, cell, cell);
    }
    ctx.fillStyle = shape.color.fill;
    ctx.fill();
    ctx.beginPath();
    for (const edge of shape.edges) {
      const from = blockToScreen(view, edge.x1, edge.z1);
      const to = blockToScreen(view, edge.x2, edge.z2);
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
    }
    ctx.strokeStyle = selected ? palette.selected : shape.color.stroke;
    ctx.lineWidth = selected ? 3 : 1.5;
    ctx.lineCap = "square";
    ctx.stroke();
    if (shape.areas.length) {
      ctx.setLineDash(LAND_AREA_DASH);
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = shape.color.stroke;
      for (const area of shape.areas) {
        const topLeft = blockToScreen(view, area.minX, area.minZ);
        const bottomRight = blockToScreen(view, area.maxX + 1, area.maxZ + 1);
        const width = bottomRight.x - topLeft.x;
        ctx.strokeRect(topLeft.x, topLeft.y, width, bottomRight.y - topLeft.y);
        if (width >= REGION_LABEL_MIN_PX && bottomRight.y - topLeft.y >= 20) drawLabel(ctx, palette, area.name, topLeft.x + 4, topLeft.y + 10, "left");
      }
      ctx.setLineDash([]);
    }
  }
}

/** 标注名称的宽度（带缓存）。使用场景：drawLandMarkers 排版前测量 */
function labelWidth(ctx: Context2D, text: string, font: string): number {
  const key = `${font}|${text}`;
  const cached = rt.labelWidths.get(key);
  if (cached !== undefined) return cached;
  ctx.font = font;
  const width = ctx.measureText(text).width;
  rt.labelWidths.set(key, width);
  return width;
}

/** 在 (cx, cy) 画一个白色小旗（领地图标）；size 为图形的高度。使用场景：领地图标与大头钉的圆头 */
function drawFlagGlyph(ctx: Context2D, color: string, cx: number, cy: number, size: number): void {
  const poleX = cx - size * 0.3;
  const top = cy - size * 0.5;
  ctx.beginPath();
  ctx.moveTo(poleX, top);
  ctx.lineTo(cx + size * 0.45, top + size * 0.22);
  ctx.lineTo(poleX, top + size * 0.44);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(poleX, top);
  ctx.lineTo(poleX, cy + size * 0.5);
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1.5, size * 0.13);
  ctx.lineCap = "round";
  ctx.stroke();
}

/** 实心圆 + 描边。使用场景：领地小圆点、图标底圆、大头钉锚点 */
function drawDisc(ctx: Context2D, x: number, y: number, radius: number, fill: string, outline: string, lineWidth: number): void {
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = outline;
  ctx.lineWidth = lineWidth;
  ctx.stroke();
}

/**
 * 画选中领地的大头钉（Apple 地图选中地点的气球）：锚点上一个小圆点，上方圆头 + 收向锚点的尾巴，圆头里画小旗，名称加粗写在锚点下方。
 * 选中后 LAND_PIN_POP_MS 内从小到大弹出（带一点回弹），动画期间逐帧重绘。
 */
function drawLandPin(ctx: Context2D, palette: Palette, shape: LandShape, x: number, y: number): void {
  const { pinRadius, pinHeight, labelGap, labelHeight } = LAND_MARKER_METRICS;
  const pop = rt.pinPop;
  const t = pop && pop.id === shape.land.id ? Math.min(1, (Date.now() - pop.startAt) / LAND_PIN_POP_MS) : 1;
  // easeOutBack：先略超过原尺寸再回落
  const overshoot = 1.7;
  const scale = 1 + (overshoot + 1) * (t - 1) ** 3 + overshoot * (t - 1) ** 2;
  if (t < 1) requestDraw();
  const color = shape.color.stroke;
  drawDisc(ctx, x, y, LAND_DOT_RADIUS, color, palette.outline, 1.5);
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  // 尾巴两侧与圆头相接处偏离正下方 40 度，尾尖落在锚点小圆点的顶上
  const spread = (40 * Math.PI) / 180;
  ctx.beginPath();
  ctx.arc(0, -pinHeight, pinRadius, Math.PI / 2 + spread, Math.PI / 2 - spread);
  ctx.lineTo(0, -LAND_DOT_RADIUS);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = palette.outline;
  ctx.lineWidth = 2;
  ctx.lineJoin = "round";
  ctx.stroke();
  drawFlagGlyph(ctx, palette.bubbleText, 0, -pinHeight, pinRadius * 1.1);
  ctx.restore();
  drawLabel(ctx, palette, shape.land.name, x, y + labelGap + labelHeight / 2, "center", PIN_LABEL_FONT);
}

/**
 * 画领地标注（Apple 地图的地点标注）：锚点为领地的标签点（core/map-lands.ts 的 labelAt，保证落在领地内），
 * 按 core/map-markers.ts 的避让排版画成小圆点、圆形图标（放得下时写名称）或选中时的大头钉；
 * 先画小圆点、再画图标、最后画大头钉，排版结果留在 rt.landMarkers 供点击命中。
 * 使用场景：「领地」图层打开时，画在领地填充之上、玩家之下。
 */
function drawLandMarkers(ctx: Context2D, palette: Palette, view: Viewport): void {
  const { iconRadius, pinRadius, pinHeight, labelGap, labelHeight } = LAND_MARKER_METRICS;
  const selectedId = rt.selection?.kind === "land" ? rt.selection.id : null;
  // 锚点在屏幕外一点的也参与排版，大头钉的圆头和名称可能伸进屏幕
  const margin = pinHeight + pinRadius;
  const shapes: LandShape[] = [];
  const inputs: MarkerInput[] = [];
  for (const shape of rt.landMarkerOrder) {
    const at = blockToScreen(view, shape.labelAt.x, shape.labelAt.z);
    if (at.x < -margin || at.y < -margin || at.x > view.width + margin || at.y > view.height + margin) continue;
    const font = shape.land.id === selectedId ? PIN_LABEL_FONT : LABEL_FONT;
    shapes.push(shape);
    inputs.push({ id: shape.land.id, x: at.x, y: at.y, labelWidth: shape.land.name ? labelWidth(ctx, shape.land.name, font) : 0 });
  }
  const placements = layoutMarkers(inputs, selectedId, LAND_MARKER_METRICS);
  rt.landMarkers = placements;
  for (const placement of placements) {
    if (placement.kind === "dot") drawDisc(ctx, placement.x, placement.y, LAND_DOT_RADIUS, shapes[placement.index]!.color.stroke, palette.outline, 1.5);
  }
  for (const placement of placements) {
    if (placement.kind !== "icon") continue;
    const shape = shapes[placement.index]!;
    drawDisc(ctx, placement.x, placement.y, iconRadius, shape.color.stroke, palette.outline, 2);
    drawFlagGlyph(ctx, palette.bubbleText, placement.x, placement.y, iconRadius * 1.1);
    if (placement.showLabel) drawLabel(ctx, palette, shape.land.name, placement.x, placement.y + iconRadius + labelGap + labelHeight / 2, "center");
  }
  for (const placement of placements) {
    if (placement.kind === "pin") drawLandPin(ctx, palette, shapes[placement.index]!, placement.x, placement.y);
  }
}

/**
 * 画区块网格：暗线加错开 1 像素的亮线；缩小时按 chunkGridSpacing 自动稀疏，太小就不画。
 * 使用场景：「区块」图层打开时，画在瓦片之上、区域与领地之下。
 */
function drawChunkGrid(ctx: Context2D, palette: Palette, view: Viewport): void {
  const spacing = chunkGridSpacing(view.scale);
  if (spacing === null) return;
  const rect = viewBlockRect(view);
  const xs: number[] = [];
  const ys: number[] = [];
  // 取整到像素中线，1 像素线不发虚
  for (let x = Math.ceil(rect.minX / spacing) * spacing; x <= rect.maxX; x += spacing) xs.push(Math.round(blockToScreen(view, x, 0).x) + 0.5);
  for (let z = Math.ceil(rect.minZ / spacing) * spacing; z <= rect.maxZ; z += spacing) ys.push(Math.round(blockToScreen(view, 0, z).y) + 0.5);
  const strokeGrid = (offset: number, color: string) => {
    ctx.beginPath();
    for (const x of xs) {
      ctx.moveTo(x + offset, 0);
      ctx.lineTo(x + offset, view.height);
    }
    for (const y of ys) {
      ctx.moveTo(0, y + offset);
      ctx.lineTo(view.width, y + offset);
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.stroke();
  };
  strokeGrid(0, palette.grid);
  strokeGrid(1, palette.gridHighlight);
}

/** 重绘整张画布 */
function draw(): void {
  const { ctx, view, meta } = rt;
  if (!ctx || !view || !meta) return;
  const palette = colors();
  ctx.setTransform(rt.dpr, 0, 0, rt.dpr, 0, 0);
  ctx.fillStyle = palette.bg;
  ctx.fillRect(0, 0, view.width, view.height);
  drawTiles(ctx, view, meta);
  if (rt.showChunks) drawChunkGrid(ctx, palette, view);
  if (rt.showRegions) drawRegions(ctx, palette, view);
  if (rt.showLands) {
    drawLands(ctx, palette, view);
    drawLandMarkers(ctx, palette, view);
  }
  if (rt.showPlayers) {
    // 自己最后画，压在其他玩家之上
    let self: MapPlayer | null = null;
    for (const player of rt.players) {
      if (!isOverworld(player.dimension)) continue;
      if (isMe(player.name)) {
        self = player;
        continue;
      }
      drawPlayer(ctx, palette, view, player, isSelectedPlayer(player.name));
    }
    if (self) drawSelf(ctx, palette, view, self, isSelectedPlayer(self.name));
  }
  drawScaleBar(ctx, palette, view);
}

/** 该玩家是否为当前选中对象 */
function isSelectedPlayer(name: string): boolean {
  return rt.selection?.kind === "player" && rt.selection.name === name;
}

/** 自己在主世界时的位置；未绑定、不在线或不在主世界时为 null。使用场景：列表按距离排序、地点卡的「距离」 */
function selfInOverworld(): MapPlayer | null {
  return rt.players.find((player) => isMe(player.name) && isOverworld(player.dimension)) ?? null;
}

/** 两点的水平距离（格，四舍五入）。使用场景：列表行尾与地点卡的「距离」 */
function horizontalDistance(from: { x: number; z: number }, x: number, z: number): number {
  return Math.round(Math.hypot(x - from.x, z - from.z));
}

/** 区域的中心方块坐标（max 为含）。使用场景：区域的距离排序与「复制坐标」 */
function regionCenter(region: MapRegion): { x: number; z: number } {
  return { x: Math.floor((region.minX + region.maxX + 1) / 2), z: Math.floor((region.minZ + region.maxZ + 1) / 2) };
}

/** 面板「在线玩家」与「其他维度」分组里的一行 */
interface PlayerRow {
  name: string;
  initial: string;
  /** 头像底色色相（hashHue），与地图上的气泡同色 */
  hue: number;
  /** 是否为自己（行内显示「我」） */
  me: boolean;
  /** 行尾灰色值：主世界为距离或坐标，其他维度为维度名 */
  end: string;
}

/** 面板「区域与领地」分组里的一行 */
interface PlaceRow {
  /** wx:key，kind + id */
  key: string;
  kind: "land" | "region";
  id: string;
  name: string;
  /** 行尾灰色值：领地 / 区域 */
  typeLabel: string;
  /** 图标底块的颜色类与图标名 */
  tile: string;
  icon: string;
}

/** 地点卡的一个操作按钮。使用场景：onPlaceAction 按 key 分派 */
interface PlaceAction {
  key: "locate" | "copy" | "follow";
  label: string;
  icon: string;
  /** 「跟随」开启时高亮 */
  active: boolean;
}

/** 地点卡详情列表的一行（标题在左、值在右） */
interface PlaceDetail {
  label: string;
  value: string;
}

/** 领地地点卡的一个子区域；current 为点击处所在的子区域 */
interface PlaceArea {
  id: string;
  name: string;
  current: boolean;
}

/**
 * 地点卡：选中对象的标题、一行类型说明、操作按钮、详情行与（领地的）子区域。
 * 取代原先底部信息卡的 selectedTitle / selectedDesc 一行描述，原描述里的各项拆成详情行。
 */
interface PlaceView {
  title: string;
  subtitle: string;
  actions: PlaceAction[];
  details: PlaceDetail[];
  areas: PlaceArea[];
}

/** 面板内容：列表（搜索 + 分组）、地点卡、图层开关 */
type SheetView = "list" | "place" | "layers";

/** 按范围定位用的方块矩形，max 不含。使用场景：focusBounds（区域、领地、子区域） */
interface FocusBounds {
  minX: number;
  minZ: number;
  maxX: number;
  maxZ: number;
}

/** 面板上方可见区域的高度：画布顶到面板顶边，至少 MIN_VISIBLE_PX；面板未测量时为整张画布 */
function visibleHeight(view: Viewport): number {
  const top = rt.sheetTop > 0 ? rt.sheetTop : view.height;
  return Math.min(view.height, Math.max(MIN_VISIBLE_PX, top));
}

/** 两个选中是否指向同一对象（领地只比 id，不比子区域）。使用场景：改选其他对象时取消跟随 */
function sameSelection(a: Selection, b: Selection): boolean {
  if (!a || !b || a.kind !== b.kind) return false;
  if (a.kind === "player") return b.kind === "player" && a.name === b.name;
  return a.id === (b as { id: string }).id;
}

/** 当前选中对象的定位点与范围（玩家没有范围）；对象已不存在时为 null。使用场景：focusSelection */
function selectionTarget(): { x: number; z: number; bounds?: FocusBounds } | null {
  const selection = rt.selection;
  if (selection?.kind === "player") {
    const player = rt.players.find((item) => item.name === selection.name && isOverworld(item.dimension));
    return player ? { x: player.x, z: player.z } : null;
  }
  if (selection?.kind === "region") {
    const region = rt.regions.find((item) => item.id === selection.id);
    if (!region) return null;
    return { ...regionCenter(region), bounds: { minX: region.minX, minZ: region.minZ, maxX: region.maxX + 1, maxZ: region.maxZ + 1 } };
  }
  if (selection?.kind === "land") {
    const shape = rt.landShapes.find((item) => item.land.id === selection.id);
    return shape ? { ...shape.labelAt, bounds: shape.bounds } : null;
  }
  return null;
}

/** 「复制坐标」的文本：玩家为 x, y, z，区域为中心 x, z，领地为标签点 x, z（与详情行的写法一致） */
function selectionCoordinates(): string {
  const selection = rt.selection;
  if (selection?.kind === "player") {
    const player = rt.players.find((item) => item.name === selection.name);
    return player ? `${Math.floor(player.x)}, ${Math.floor(player.y)}, ${Math.floor(player.z)}` : "";
  }
  const target = selectionTarget();
  return target ? `${Math.floor(target.x)}, ${Math.floor(target.z)}` : "";
}

/** 地点卡的操作按钮：定位、复制坐标，玩家另有「跟随」（开启时高亮并显示「跟随中」） */
function placeActions(followable: boolean): PlaceAction[] {
  const actions: PlaceAction[] = [
    { key: "locate", label: "定位", icon: "location", active: false },
    { key: "copy", label: "复制坐标", icon: "copy", active: false },
  ];
  if (followable) actions.push({ key: "follow", label: rt.following ? "跟随中" : "跟随", icon: "user", active: rt.following });
  return actions;
}

/**
 * 按当前选中与数据生成地点卡；没有选中或对象已不存在时为 null。
 * 详情沿用原信息卡的内容（坐标、范围、领主、状态、子区域），另加距离（自己在主世界时）、大小、等级与区块数。
 */
function buildPlace(): PlaceView | null {
  const selection = rt.selection;
  const self = selfInOverworld();
  if (selection?.kind === "player") {
    const player = rt.players.find((item) => item.name === selection.name && isOverworld(item.dimension));
    if (!player) return null;
    const me = isMe(player.name);
    const details: PlaceDetail[] = [{ label: "坐标", value: `${Math.floor(player.x)}, ${Math.floor(player.y)}, ${Math.floor(player.z)}` }];
    if (self && !me) details.push({ label: "距离", value: `${horizontalDistance(self, player.x, player.z)} 格` });
    return { title: player.name, subtitle: `${me ? "我" : "玩家"} · 主世界`, actions: placeActions(true), details, areas: [] };
  }
  if (selection?.kind === "region") {
    const region = rt.regions.find((item) => item.id === selection.id);
    if (!region) return null;
    const details: PlaceDetail[] = [
      { label: "范围", value: `${region.minX}, ${region.minZ} → ${region.maxX}, ${region.maxZ}` },
      { label: "大小", value: `${region.maxX - region.minX + 1} × ${region.maxZ - region.minZ + 1} 格` },
    ];
    if (self) {
      const center = regionCenter(region);
      details.push({ label: "距离", value: `${horizontalDistance(self, center.x, center.z)} 格` });
    }
    return { title: region.name, subtitle: `${regionKindLabel(region.kind)} · 主世界`, actions: placeActions(false), details, areas: [] };
  }
  if (selection?.kind === "land") {
    const shape = rt.landShapes.find((item) => item.land.id === selection.id);
    if (!shape) return null;
    const { land } = shape;
    const details: PlaceDetail[] = [];
    if (land.ownerName) details.push({ label: "领主", value: land.ownerName });
    if (land.status) details.push({ label: "状态", value: landStatusLabel(land.status) });
    if (land.level > 0) details.push({ label: "等级", value: `${land.level} 级` });
    details.push({ label: "区块", value: `${shape.chunks.length} 个` });
    if (self) details.push({ label: "距离", value: `${horizontalDistance(self, shape.labelAt.x, shape.labelAt.z)} 格` });
    const areas = shape.areas.map((area): PlaceArea => ({ id: area.id, name: area.name, current: selection.areaIds.includes(area.id) }));
    return { title: land.name, subtitle: "领地 · 主世界", actions: placeActions(false), details, areas };
  }
  return null;
}

/** 页面 data 结构 */
interface MapData {
  configured: boolean;
  /** loading 首次加载；ready 有地图；unrendered 还没渲染；error 不可用（含未开启地图、网络错误） */
  status: "loading" | "ready" | "unrendered" | "error";
  errorText: string;
  /** 渲染阶段说明（unrendered 时显示） */
  renderMessage: string;
  showPlayers: boolean;
  showRegions: boolean;
  /** 「领地」图层开关 */
  showLands: boolean;
  /** 「区块」网格图层开关 */
  showChunks: boolean;
  /** 游戏服务器的位置上报已中断 */
  stale: boolean;
  /** 在线玩家总数（含其他维度）；为 0 且没有搜索时面板显示「当前没有玩家在线」 */
  onlineCount: number;
  /** 已绑定游戏账号，显示「定位到我」 */
  canLocate: boolean;
  /** 底部面板的档位与内容 */
  sheetDetent: SheetDetent;
  sheetView: SheetView;
  /** 搜索框内容（用于显示清除按钮） */
  query: string;
  /** 列表：主世界的在线玩家（自己在前，其余按距离）、其他维度的玩家、区域与领地；都已按搜索词过滤 */
  nearbyPlayers: PlayerRow[];
  otherDimensions: PlayerRow[];
  places: PlaceRow[];
  /** 有搜索词但三组都没有结果 */
  listEmpty: boolean;
  /** 选中对象的地点卡；为 null 时面板不显示地点卡 */
  place: PlaceView | null;
}

Page({
  data: {
    configured: hasHomeServer(),
    status: "loading",
    errorText: "",
    renderMessage: "",
    showPlayers: true,
    showRegions: true,
    showLands: true,
    showChunks: false,
    stale: false,
    onlineCount: 0,
    canLocate: false,
    sheetDetent: "collapsed",
    sheetView: "list",
    query: "",
    nearbyPlayers: [],
    otherDimensions: [],
    places: [],
    listEmpty: false,
    place: null,
  } as MapData,

  onLoad() {
    wx.onThemeChange(onTheme);
  },
  onUnload() {
    wx.offThemeChange(onTheme);
    this.stopPolling();
    if (rt.scaleBarTimer !== null) clearTimeout(rt.scaleBarTimer);
    rt.scaleBarTimer = null;
    rt.flight += 1;
    releaseCanvas();
  },
  onShow() {
    selectPlayerTab(this);
    if (!this.data.configured) return;
    // 「我的领地」→「在地图中查看」经 storage 传参（switchTab 不能带 query）
    try {
      const focusId = wx.getStorageSync("mapFocusLandId");
      if (focusId) {
        wx.removeStorageSync("mapFocusLandId");
        rt.pendingLandFocus = String(focusId);
      }
    } catch {
      // 存储读写失败时忽略，仍正常打开地图
    }
    void this.load().then(() => this.applyPendingLandFocus());
    this.startPolling();
  },

  /**
   * 若有 pendingLandFocus：打开领地图层并选中该领地（与列表面板点按同路径）。
   * 使用场景：从「我的领地」跳转过来；领地列表尚未就绪或 id 不存在时静默忽略。
   */
  applyPendingLandFocus() {
    const id = rt.pendingLandFocus;
    if (!id) return;
    rt.pendingLandFocus = "";
    if (this.data.status !== "ready") return;
    if (!rt.landShapes.some((shape) => shape.land.id === id)) return;
    if (!rt.showLands) this.toggleLands();
    this.select({ kind: "land", id, areaIds: [] }, true);
  },
  onHide() {
    this.stopPolling();
  },

  /** 拉取元数据、区域、领地与自己的绑定信息；有地图时初始化画布 */
  async load() {
    const ticket = ++rt.loadTicket;
    const api = homeMapApi();
    try {
      // 区域 / 领地读取失败（含旧版网关没有 /map/lands）不影响看地图，按没有区域 / 领地处理
      const [meta, regions, lands] = await Promise.all([
        api.meta(),
        api.regions().catch(() => [] as MapRegion[]),
        api.lands().catch(() => [] as MapLand[]),
      ]);
      if (ticket !== rt.loadTicket) return;
      rt.regions = regions;
      rt.landShapes = buildLandShapes(lands);
      rt.landMarkerOrder = [...rt.landShapes].sort((a, b) => b.chunks.length - a.chunks.length || (a.land.id < b.land.id ? -1 : a.land.id > b.land.id ? 1 : 0));
      rt.landMarkers = [];
      rt.labelWidths.clear();
      const rendered = renderedMeta(meta);
      if (!rendered) {
        rt.meta = null;
        releaseCanvas();
        this.setData({ status: "unrendered", renderMessage: meta.message || "服务器还没有渲染地图" });
        return;
      }
      rt.meta = rendered;
      if (rt.tiles && Date.now() - rt.tilesCreatedAt > TILE_CACHE_MAX_AGE_MS) {
        rt.tiles.clear();
        rt.tilesCreatedAt = Date.now();
      }
      this.setData({ status: "ready", errorText: "" }, () => this.initCanvas());
      this.refreshList();
      this.refreshSelection();
      void this.loadPlayers();
      void this.loadMe();
    } catch (error) {
      if (ticket !== rt.loadTicket) return;
      // 已经在看地图时（例如切回标签页刷新失败）保留画面，只在首次加载失败时显示错误页
      if (this.data.status === "ready" && rt.meta) return;
      releaseCanvas();
      this.setData({ status: "error", errorText: errorText(error) });
    }
  },

  /** 读取自己的绑定角色名（失败时不显示「定位到我」，不影响看地图） */
  async loadMe() {
    try {
      const me = await homePlayerApi().me();
      rt.myName = me.bound && me.player ? me.player.name : "";
    } catch {
      rt.myName = "";
    }
    this.setData({ canLocate: Boolean(rt.myName) });
    // 自己的位置决定列表排序与地点卡里的「距离」
    this.refreshList();
    this.refreshSelection();
    requestDraw();
  },

  /** 刷新玩家位置并更新面板列表与地点卡；跟随中时把地图移到被跟随的玩家；失败时保留上一次的位置 */
  async loadPlayers() {
    if (this.data.status !== "ready") return;
    try {
      const result = await homeMapApi().players();
      rt.players = result.players;
      rt.stale = result.stale;
      this.setData({ stale: result.stale, onlineCount: result.players.length });
      this.refreshList();
      this.refreshSelection();
      const selection = rt.selection;
      if (rt.following && selection?.kind === "player") {
        const player = rt.players.find((item) => item.name === selection.name);
        if (player) this.focusBlock(player.x, player.z, rt.view?.scale ?? LOCATE_MIN_SCALE);
      }
      requestDraw();
    } catch {
      // 轮询失败不打断浏览，下一轮再试
    }
  },

  startPolling() {
    this.stopPolling();
    rt.poll = setInterval(() => void this.loadPlayers(), PLAYER_POLL_MS) as unknown as number;
  },
  stopPolling() {
    if (rt.poll !== null) clearInterval(rt.poll);
    rt.poll = null;
  },

  /**
   * 取画布节点并按像素比设置尺寸；首次进入时让整张地图适配屏幕。
   * 标签页切换不会销毁画布，已初始化时只重绘，保留瓦片缓存（canvas.createImage 的图片只能画在创建它的画布上）。
   */
  initCanvas() {
    if (rt.canvas) {
      requestDraw();
      return;
    }
    this.createSelectorQuery()
      .select("#map")
      .fields({ node: true, size: true })
      .exec((result) => {
        const target = result?.[0] as { node?: WechatMiniprogram.Canvas; width: number; height: number } | undefined;
        const meta = rt.meta;
        if (!target?.node || !target.width || !meta || rt.canvas) return;
        const canvas = target.node;
        rt.dpr = wx.getWindowInfo().pixelRatio;
        canvas.width = Math.round(target.width * rt.dpr);
        canvas.height = Math.round(target.height * rt.dpr);
        rt.canvas = canvas;
        rt.ctx = canvas.getContext("2d");
        rt.frame = null;
        rt.tiles = new TileCache({
          createImage: () => canvas.createImage(),
          onChange: () => requestDraw(),
          limit: TILE_CACHE_LIMIT,
          parallel: TILE_PARALLEL,
          retryAfterMs: TILE_RETRY_MS,
        });
        rt.tilesCreatedAt = Date.now();
        rt.view = rt.view ? clampCenter({ ...rt.view, width: target.width, height: target.height }, meta.bounds) : initialViewport(meta, target.width, target.height);
        requestDraw();
      });
  },

  /** 更新视口并重绘（限制中心点不离开地图边界） */
  setView(next: Viewport) {
    if (!rt.meta) return;
    rt.view = clampCenter(next, rt.meta.bounds);
    requestDraw();
  },

  /**
   * 动画移到目标视口：中心线性插值、比例按对数插值（缩放速度均匀），缓出曲线。
   * 新动画或手指按下地图时 rt.flight 加一，旧动画在下一帧停止。使用场景：定位、点选列表项、跟随、回到全图。
   */
  flyTo(target: Viewport) {
    const from = rt.view;
    const canvas = rt.canvas;
    if (!from || !canvas) return;
    const ticket = ++rt.flight;
    const startAt = Date.now();
    const step = () => {
      if (ticket !== rt.flight || rt.canvas !== canvas) return;
      const t = Math.min(1, (Date.now() - startAt) / FLY_MS);
      const k = 1 - (1 - t) ** 3;
      this.setView({
        ...from,
        centerX: from.centerX + (target.centerX - from.centerX) * k,
        centerZ: from.centerZ + (target.centerZ - from.centerZ) * k,
        scale: from.scale * (target.scale / from.scale) ** k,
      });
      if (t < 1) canvas.requestAnimationFrame(step);
    };
    step();
  },

  /** 把方块 (x, z) 移到面板上方可见区域的中心，并缩放到 scale */
  focusBlock(x: number, z: number, scale: number) {
    const view = rt.view;
    if (!view) return;
    const visible = visibleHeight(view);
    this.flyTo({ ...view, scale, centerX: x, centerZ: z + (view.height / 2 - visible / 2) / scale });
  },

  /** 把一个范围（max 不含）缩放到可见区域的 FIT_BOUNDS_RATIO 并居中 */
  focusBounds(bounds: FocusBounds) {
    const view = rt.view;
    const meta = rt.meta;
    if (!view || !meta) return;
    const limits = scaleLimits(meta);
    const width = Math.max(1, bounds.maxX - bounds.minX);
    const height = Math.max(1, bounds.maxZ - bounds.minZ);
    const fit = Math.min(view.width / width, visibleHeight(view) / height) * FIT_BOUNDS_RATIO;
    this.focusBlock((bounds.minX + bounds.maxX) / 2, (bounds.minZ + bounds.maxZ) / 2, Math.min(limits.max, Math.max(limits.min, fit)));
  },

  /** 双指缩放时显示比例尺，停止缩放 SCALE_BAR_SHOW_MS 后重绘一次把它隐藏 */
  showScaleBar() {
    rt.scaleBarUntil = Date.now() + SCALE_BAR_SHOW_MS;
    if (rt.scaleBarTimer !== null) clearTimeout(rt.scaleBarTimer);
    rt.scaleBarTimer = setTimeout(() => {
      rt.scaleBarTimer = null;
      requestDraw();
    }, SCALE_BAR_SHOW_MS) as unknown as number;
  },

  onTouchStart(event: WechatMiniprogram.TouchCanvas) {
    // 手指按下时停止正在进行的「飞到目标」动画，避免与拖动抢视口
    rt.flight += 1;
    const points = canvasTouches(event);
    const gesture = rt.gesture;
    if (gesture.points.length === 0 && points.length === 1) {
      gesture.start = points[0]!;
      gesture.startAt = Date.now();
      gesture.moved = false;
    }
    if (points.length > 1) gesture.moved = true;
    gesture.points = points;
  },
  onTouchMove(event: WechatMiniprogram.TouchCanvas) {
    const view = rt.view;
    const meta = rt.meta;
    const gesture = rt.gesture;
    const points = canvasTouches(event);
    if (!view || !meta || !points.length) return;
    const previous = gesture.points;
    if (points.length >= 2 && previous.length >= 2) {
      const lastMid = touchMidpoint(previous[0]!, previous[1]!);
      const mid = touchMidpoint(points[0]!, points[1]!);
      const lastDistance = touchDistance(previous[0]!, previous[1]!);
      const distance = touchDistance(points[0]!, points[1]!);
      let next = panBy(view, mid.x - lastMid.x, mid.y - lastMid.y);
      if (lastDistance > 0) next = zoomAt(next, next.scale * (distance / lastDistance), mid, scaleLimits(meta));
      this.setView(next);
      this.showScaleBar();
    } else if (points.length === 1 && previous.length === 1) {
      const dx = points[0]!.x - previous[0]!.x;
      const dy = points[0]!.y - previous[0]!.y;
      this.setView(panBy(view, dx, dy));
      if (gesture.start && touchDistance(points[0]!, gesture.start) > TAP_SLOP_PX) gesture.moved = true;
    }
    gesture.points = points;
    // 手动拖动或缩放地图时取消跟随（Apple 地图拖动后不再跟随位置）
    if (gesture.moved) this.stopFollowing();
  },
  onTouchEnd(event: WechatMiniprogram.TouchCanvas) {
    const gesture = rt.gesture;
    const remaining = canvasTouches(event);
    const wasTap = remaining.length === 0 && !gesture.moved && gesture.start !== null && Date.now() - gesture.startAt <= TAP_MAX_MS;
    const tapAt = gesture.start;
    // 抬起一根手指后以剩下的手指继续拖动，避免地图跳一下
    gesture.points = remaining;
    if (remaining.length === 0) gesture.start = null;
    if (wasTap && tapAt) this.handleTap(tapAt);
  },

  /**
   * 点击：优先选中附近的玩家，其次选中点到的领地标注（大头钉 / 图标 / 小圆点），再次选中所在的领地（land 模块），
   * 再次选中所在的区域（area 模块），选中后打开地点卡；否则清除选中。
   * 领地与区域按各自的图层开关参与命中（原先共用「区域与领地」开关）。
   */
  handleTap(point: ScreenPoint) {
    const view = rt.view;
    if (!view) return;
    if (rt.showPlayers) {
      const overworld = rt.players.filter((player) => isOverworld(player.dimension));
      const index = hitNearest(view, overworld, point, PLAYER_HIT_RADIUS);
      if (index >= 0) {
        this.select({ kind: "player", name: overworld[index]!.name }, false);
        return;
      }
    }
    const block = screenToBlock(view, point);
    if (rt.showLands) {
      const marker = markerAt(rt.landMarkers, point, LAND_MARKER_METRICS);
      if (marker) {
        const selection = rt.selection;
        // 点同一块领地的标注时保留已记下的子区域
        const areaIds = selection?.kind === "land" && selection.id === marker.id ? selection.areaIds : [];
        this.select({ kind: "land", id: marker.id, areaIds }, false);
        return;
      }
      const land = landAt(rt.landShapes, block.x, block.z);
      if (land) {
        this.select({ kind: "land", id: land.shape.land.id, areaIds: land.areas.map((area) => area.id) }, false);
        return;
      }
    }
    if (rt.showRegions) {
      const overworld = rt.regions.filter((region) => isOverworld(region.dimension));
      const index = smallestRegionAt(overworld, block.x, block.z);
      if (index >= 0) {
        this.select({ kind: "region", id: overworld[index]!.id }, false);
        return;
      }
    }
    this.clearSelection();
  },

  /**
   * 选中一个对象并打开地点卡：面板切到地点卡、升到中档，换档完成后再定位。
   * fit 为 true（从列表点选、定位按钮）时移到目标并按范围缩放；为 false（在地图上点选）时只在目标被面板挡住或在屏幕外时平移。
   */
  select(selection: NonNullable<Selection>, fit: boolean) {
    if (!sameSelection(rt.selection, selection)) {
      rt.following = false;
      // 新选中一块领地时，它的标注从图标变成大头钉并弹出
      if (selection.kind === "land") rt.pinPop = { id: selection.id, startAt: Date.now() };
    }
    rt.selection = selection;
    this.refreshSelection();
    if (!rt.selection) return;
    requestDraw();
    this.showSheet("place", "medium", () => this.focusSelection(fit));
  },

  /** 按 fit 规则（见 select）把地图移到当前选中对象 */
  focusSelection(fit: boolean) {
    const view = rt.view;
    const meta = rt.meta;
    const target = selectionTarget();
    if (!view || !meta || !target) return;
    if (fit) {
      if (target.bounds) return this.focusBounds(target.bounds);
      const limits = scaleLimits(meta);
      return this.focusBlock(target.x, target.z, Math.min(limits.max, Math.max(view.scale, LOCATE_MIN_SCALE)));
    }
    const point = blockToScreen(view, target.x, target.z);
    if (point.x < 0 || point.x > view.width || point.y < 0 || point.y > visibleHeight(view)) this.focusBlock(target.x, target.z, view.scale);
  },

  /**
   * 切换面板内容与档位。档位不变时立即执行 focus；档位变化时面板顶边要等组件重新测量，
   * focus 暂存到 rt.pendingFocus，由 onSheetLayout 拿到新的顶边后执行。
   */
  showSheet(view: SheetView, detent: SheetDetent, focus?: () => void) {
    if (detent === this.data.sheetDetent) {
      if (view !== this.data.sheetView) this.setData({ sheetView: view });
      rt.pendingFocus = null;
      focus?.();
      return;
    }
    rt.pendingFocus = focus ?? null;
    this.setData({ sheetView: view, sheetDetent: detent });
  },

  /** map-sheet：用户拖动后吸附到新档位 */
  onSheetDetent(event: WechatMiniprogram.CustomEvent<{ detent: SheetDetent }>) {
    this.setData({ sheetDetent: event.detail.detent });
  },
  /** map-sheet：测量完成，记下面板顶边并执行换档前暂存的定位 */
  onSheetLayout(event: WechatMiniprogram.CustomEvent<SheetLayoutDetail>) {
    rt.sheetTop = event.detail.sheetTop;
    const focus = rt.pendingFocus;
    rt.pendingFocus = null;
    focus?.();
  },

  /** 搜索框输入：按关键词过滤列表 */
  onSearchInput(event: WechatMiniprogram.Input) {
    rt.query = event.detail.value;
    this.setData({ query: rt.query });
    this.refreshList();
  },
  /** 搜索框获得焦点：面板升到全屏，结果列表不被键盘挡住（Apple 地图的做法） */
  onSearchFocus() {
    this.showSheet("list", "full");
  },
  clearSearch() {
    rt.query = "";
    this.setData({ query: "" });
    this.refreshList();
  },

  /** 列表：点按主世界的玩家，打开地点卡并移到他那里（玩家图层关闭时先打开） */
  onPlayerRow(event: WechatMiniprogram.BaseEvent) {
    const name = String(event.currentTarget.dataset.name ?? "");
    if (!name) return;
    if (!rt.showPlayers) this.togglePlayers();
    this.select({ kind: "player", name }, true);
  },
  /** 列表：点按区域或领地，打开地点卡并按范围定位（对应图层关闭时先打开） */
  onPlaceRow(event: WechatMiniprogram.BaseEvent) {
    const { kind, id } = event.currentTarget.dataset as { kind?: string; id?: string };
    if (!id) return;
    if (kind === "land") {
      if (!rt.showLands) this.toggleLands();
      this.select({ kind: "land", id, areaIds: [] }, true);
    } else {
      if (!rt.showRegions) this.toggleRegions();
      this.select({ kind: "region", id }, true);
    }
  },
  /** 地点卡：点按领地的子区域，标为当前子区域并按子区域范围定位 */
  onAreaRow(event: WechatMiniprogram.BaseEvent) {
    const selection = rt.selection;
    const id = String(event.currentTarget.dataset.id ?? "");
    if (selection?.kind !== "land" || !id) return;
    const area = rt.landShapes.find((shape) => shape.land.id === selection.id)?.areas.find((item) => item.id === id);
    if (!area) return;
    rt.selection = { ...selection, areaIds: [id] };
    this.refreshSelection();
    requestDraw();
    this.focusBounds({ minX: area.minX, minZ: area.minZ, maxX: area.maxX + 1, maxZ: area.maxZ + 1 });
  },
  /** 地点卡的操作按钮：定位、复制坐标、跟随（仅玩家） */
  onPlaceAction(event: WechatMiniprogram.BaseEvent) {
    const key = String(event.currentTarget.dataset.key ?? "") as PlaceAction["key"];
    if (key === "locate") {
      this.focusSelection(true);
    } else if (key === "copy") {
      const text = selectionCoordinates();
      if (text) wx.setClipboardData({ data: text });
    } else if (key === "follow") {
      rt.following = !rt.following;
      this.refreshSelection();
      if (rt.following) this.focusSelection(true);
    }
  },
  /** 取消跟随并刷新地点卡上的「跟随」按钮 */
  stopFollowing() {
    if (!rt.following) return;
    rt.following = false;
    this.refreshSelection();
  },

  /** 控件胶囊的「图层」：打开图层面板；已打开时关闭 */
  openLayers() {
    if (this.data.sheetView === "layers") {
      this.closeLayers();
      return;
    }
    this.showSheet("layers", "medium");
  },
  /** 关闭图层面板：有选中对象时回到地点卡，否则回到收起的列表 */
  closeLayers() {
    if (this.data.place) this.showSheet("place", "medium");
    else this.showSheet("list", "collapsed");
  },

  /**
   * 按当前数据重建面板列表：主世界玩家（自己在前，其余按与自己的距离，自己不在主世界时按服务器顺序）、
   * 其他维度玩家、区域与领地（自己在主世界时按距离），都按搜索词过滤（不区分大小写）。
   */
  refreshList() {
    const query = rt.query.trim().toLowerCase();
    const matches = (name: string) => !query || name.toLowerCase().includes(query);
    const self = selfInOverworld();
    const nearbyPlayers = rt.players
      .filter((player) => isOverworld(player.dimension) && matches(player.name))
      .map((player) => ({ player, me: isMe(player.name), distance: self ? horizontalDistance(self, player.x, player.z) : 0 }))
      .sort((a, b) => Number(b.me) - Number(a.me) || a.distance - b.distance)
      .map(({ player, me, distance }): PlayerRow => ({
        name: player.name,
        initial: initialOf(player.name),
        hue: hashHue(player.name),
        me,
        end: me ? "" : self ? `${distance} 格` : `${Math.floor(player.x)}, ${Math.floor(player.z)}`,
      }));
    const otherDimensions = rt.players
      .filter((player) => !isOverworld(player.dimension) && matches(player.name))
      .map((player): PlayerRow => ({ name: player.name, initial: initialOf(player.name), hue: hashHue(player.name), me: isMe(player.name), end: dimensionLabel(player.dimension) }));
    const candidates: Array<{ row: PlaceRow; at: { x: number; z: number } }> = [
      ...rt.landShapes
        .filter((shape) => matches(shape.land.name))
        .map((shape) => ({
          row: { key: `land:${shape.land.id}`, kind: "land" as const, id: shape.land.id, name: shape.land.name, typeLabel: "领地", tile: "tile-green", icon: "layers" },
          at: shape.labelAt,
        })),
      ...rt.regions
        .filter((region) => isOverworld(region.dimension) && matches(region.name))
        .map((region) => ({
          row: {
            key: `region:${region.id}`,
            kind: "region" as const,
            id: region.id,
            name: region.name,
            typeLabel: regionKindLabel(region.kind),
            tile: region.kind === "land" ? "tile-green" : "tile-blue",
            icon: region.kind === "land" ? "layers" : "shield",
          },
          at: regionCenter(region),
        })),
    ];
    if (self) candidates.sort((a, b) => horizontalDistance(self, a.at.x, a.at.z) - horizontalDistance(self, b.at.x, b.at.z));
    const places = candidates.map((item) => item.row);
    this.setData({
      nearbyPlayers,
      otherDimensions,
      places,
      listEmpty: Boolean(query) && !nearbyPlayers.length && !otherDimensions.length && !places.length,
    });
  },

  /** 按当前数据刷新地点卡；选中的对象已不存在（玩家下线或离开主世界、区域被删除）时清除选中 */
  refreshSelection() {
    const place = buildPlace();
    if (place) {
      this.setData({ place });
      return;
    }
    if (rt.selection) return this.clearSelection();
    if (this.data.place) this.setData({ place: null });
  },
  /** 清除选中：关闭地点卡、取消跟随，面板回到收起的列表（图层面板打开时保持不动） */
  clearSelection() {
    rt.selection = null;
    rt.following = false;
    if (this.data.place) this.setData({ place: null });
    if (this.data.sheetView === "place") this.showSheet("list", "collapsed");
    requestDraw();
  },

  togglePlayers() {
    rt.showPlayers = !rt.showPlayers;
    this.setData({ showPlayers: rt.showPlayers });
    if (!rt.showPlayers && rt.selection?.kind === "player") this.clearSelection();
    requestDraw();
  },
  /** 开关 area 模块的区域 */
  toggleRegions() {
    rt.showRegions = !rt.showRegions;
    this.setData({ showRegions: rt.showRegions });
    if (!rt.showRegions && rt.selection?.kind === "region") this.clearSelection();
    requestDraw();
  },
  /** 开关 land 模块的领地 */
  toggleLands() {
    rt.showLands = !rt.showLands;
    this.setData({ showLands: rt.showLands });
    if (!rt.showLands && rt.selection?.kind === "land") this.clearSelection();
    requestDraw();
  },
  /** 开关区块网格 */
  toggleChunks() {
    rt.showChunks = !rt.showChunks;
    this.setData({ showChunks: rt.showChunks });
    requestDraw();
  },

  /** 复位到初始视图（地图中心 + 建议层级）；入口在图层面板的「回到全图」 */
  resetView() {
    const view = rt.view;
    const meta = rt.meta;
    if (!view || !meta) return;
    this.flyTo(initialViewport(meta, view.width, view.height));
  },

  /** 定位到自己：在线且在主世界时选中自己、打开地点卡并移到自己的位置 */
  locateMe() {
    const view = rt.view;
    const meta = rt.meta;
    if (!view || !meta) return;
    const me = rt.players.find((player) => isMe(player.name));
    if (!me) {
      wx.showToast({ title: `${rt.myName} 当前不在线`, icon: "none" });
      return;
    }
    if (!isOverworld(me.dimension)) {
      wx.showToast({ title: `你在${dimensionLabel(me.dimension)}，地图只显示主世界`, icon: "none" });
      return;
    }
    if (!rt.showPlayers) this.togglePlayers();
    this.select({ kind: "player", name: me.name }, true);
  },

  retry() {
    this.setData({ status: "loading", errorText: "" });
    void this.load();
  },
});
