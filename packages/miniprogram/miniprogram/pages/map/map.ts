/**
 * map — 玩家端「地图」
 *
 * 使用场景：查看服务器主世界的俯视地图（bluemap / uNmINeD 渲染的瓦片）、所有在线玩家的位置，以及区域与领地范围。
 * - canvas 2d 原生绘制：单指拖动、双指缩放，用 canvas.requestAnimationFrame 按需重绘；
 * - 瓦片走 core/tile-cache.ts 的 LRU 缓存，目标层级还没加载完时用已缓存的低一级瓦片放大占位；
 * - 玩家、区域与领地、区块网格三个图层可开关；点击玩家显示名字与坐标，点击空白处显示所在领地（含子区域）或区域；
 * - 领地来自 land 模块（…/map/lands，按区块画填充、外轮廓与子区域虚线框，几何在 core/map-lands.ts），
 *   区域来自 area 模块（…/map/regions，矩形）；
 * - 不在主世界的玩家列在底部，不画在图上（瓦片只覆盖主世界）；
 * - 已绑定游戏账号时显示「定位到我」，按游戏角色名匹配自己的位置；
 * - 页面显示时每 5 秒刷新玩家位置，隐藏时停止；元数据、区域与领地在每次进入页面时拉取。
 * 数据来自 core/map-api.ts（mp-gateway 只读转发），视口与瓦片计算在 core/map-view.ts。
 */
import { errorText } from "../../core/format";
import { homeMapApi, renderedMeta, type MapLand, type MapPlayer, type MapRegion, type RenderedMapMeta } from "../../core/map-api";
import { buildLandShapes, landAt, landStatusLabel, type LandShape } from "../../core/map-lands";
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
import { homePlayerApi } from "../../core/player-api";
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
/** 点击玩家箭头的命中半径（CSS 像素） */
const PLAYER_HIT_RADIUS = 24;
/** 缩放按钮每次放大 / 缩小的倍数 */
const ZOOM_BUTTON_FACTOR = 2;
/** 「定位到我」时至少放大到每方块的像素数，便于看清周围 */
const LOCATE_MIN_SCALE = 2;
/** 区域在屏幕上至少这么宽（CSS 像素）才写名称，避免小领地的字糊成一团 */
const REGION_LABEL_MIN_PX = 48;
/** 领地子区域虚线框的线段 / 间隔长度（CSS 像素）。使用场景：drawLands */
const LAND_AREA_DASH = [4, 3];

/**
 * 画布配色。canvas 读不到 CSS 变量，按系统主题取两套。
 * bg 与 theme.json 的 pageBg 一致（地图边界外的底色）；玩家与区域颜色叠在地形上，需要描边保证对比度。
 * grid / gridHighlight 是区块网格的暗线与错开 1 像素的亮线，深浅地形上都能看清（与 bluemap 网页 chunkGridStyle 同色）。
 * land 模块的领地按 id 取色（core/map-lands.ts 的 landColor），不在这里。
 */
const MAP_COLORS = {
  light: { bg: "#f5f5f6", player: "#2563eb", self: "#ea580c", outline: "#ffffff", label: "#1c1c1c", labelHalo: "rgba(255,255,255,0.85)", area: "rgba(37,99,235,0.95)", areaFill: "rgba(37,99,235,0.10)", land: "rgba(22,163,74,0.95)", landFill: "rgba(22,163,74,0.12)", selected: "#facc15", grid: "rgba(0,0,0,0.55)", gridHighlight: "rgba(255,255,255,0.65)" },
  dark: { bg: "#1d1d1d", player: "#60a5fa", self: "#fb923c", outline: "#111111", label: "#f2f2f2", labelHalo: "rgba(0,0,0,0.75)", area: "rgba(96,165,250,0.95)", areaFill: "rgba(96,165,250,0.12)", land: "rgba(74,222,128,0.95)", landFill: "rgba(74,222,128,0.14)", selected: "#facc15", grid: "rgba(0,0,0,0.55)", gridHighlight: "rgba(255,255,255,0.65)" },
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
  tiles: null as TileCache<WechatMiniprogram.Image> | null,
  tilesCreatedAt: 0,
  /** 已排队的动画帧；非 null 时不重复请求 */
  frame: null as number | null,
  gesture: { points: [], start: null, startAt: 0, moved: false } as Gesture,
  poll: null as number | null,
  /** 当前微信绑定的游戏角色名；未绑定为空 */
  myName: "",
  selection: null as Selection,
  /** 图层开关（与 data.showPlayers / showRegions / showChunks 同步，绘制时读这里，免得每帧读页面实例） */
  showPlayers: true,
  showRegions: true,
  /** 区块网格默认关闭（与网页版一致），放大看领地边界时再打开 */
  showChunks: false,
  /** 丢弃过期的加载结果（快速切换标签页时旧请求晚到） */
  loadTicket: 0,
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

/** 画一个带名字的玩家箭头；yaw 0 朝南，箭头默认朝上（北），所以旋转 yaw + 180 度（与网页版一致） */
function drawPlayer(ctx: Context2D, palette: Palette, view: Viewport, player: MapPlayer, selected: boolean): void {
  const point = blockToScreen(view, player.x, player.z);
  if (point.x < -40 || point.y < -40 || point.x > view.width + 40 || point.y > view.height + 40) return;
  ctx.save();
  ctx.translate(point.x, point.y);
  ctx.rotate(((player.yaw + 180) * Math.PI) / 180);
  ctx.beginPath();
  ctx.moveTo(0, -11);
  ctx.lineTo(8, 8);
  ctx.lineTo(0, 4);
  ctx.lineTo(-8, 8);
  ctx.closePath();
  ctx.fillStyle = isMe(player.name) ? palette.self : palette.player;
  ctx.strokeStyle = selected ? palette.selected : palette.outline;
  ctx.lineWidth = selected ? 3 : 2;
  ctx.lineJoin = "round";
  ctx.stroke();
  ctx.fill();
  ctx.restore();
  drawLabel(ctx, palette, player.name, point.x, point.y + 22, "center");
}

/** 带描边光晕的文字，压在地形上也能看清 */
function drawLabel(ctx: Context2D, palette: Palette, text: string, x: number, y: number, align: "center" | "left"): void {
  ctx.font = "12px sans-serif";
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
 * 画 land 模块的领地：按区块半透明填充、只描外轮廓，子区域画虚线框；
 * 领地在屏幕上足够宽时在标签点写领地名，子区域足够宽时在左上角写子区域名。
 * 使用场景：「区域与领地」图层打开时，画在 area 矩形之上。
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
    if ((bounds.maxX - bounds.minX) * view.scale >= REGION_LABEL_MIN_PX) {
      const at = blockToScreen(view, shape.labelAt.x, shape.labelAt.z);
      drawLabel(ctx, palette, shape.land.name, at.x, at.y, "center");
    }
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
  if (rt.showRegions) {
    drawRegions(ctx, palette, view);
    drawLands(ctx, palette, view);
  }
  if (rt.showPlayers) {
    for (const player of rt.players) {
      if (!isOverworld(player.dimension)) continue;
      drawPlayer(ctx, palette, view, player, rt.selection?.kind === "player" && rt.selection.name === player.name);
    }
  }
}

/** 底部列出的一名不在主世界的玩家 */
interface OtherDimensionPlayer {
  name: string;
  dimension: string;
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
  /** 「区块」网格图层开关 */
  showChunks: boolean;
  /** 游戏服务器的位置上报已中断 */
  stale: boolean;
  onlineCount: number;
  otherDimensions: OtherDimensionPlayer[];
  /** 已绑定游戏账号，显示「定位到我」 */
  canLocate: boolean;
  /** 选中对象的标题与说明；标题为空时不显示信息卡 */
  selectedTitle: string;
  selectedDesc: string;
}

Page({
  data: {
    configured: hasHomeServer(),
    status: "loading",
    errorText: "",
    renderMessage: "",
    showPlayers: true,
    showRegions: true,
    showChunks: false,
    stale: false,
    onlineCount: 0,
    otherDimensions: [],
    canLocate: false,
    selectedTitle: "",
    selectedDesc: "",
  } as MapData,

  onLoad() {
    wx.onThemeChange(onTheme);
  },
  onUnload() {
    wx.offThemeChange(onTheme);
    this.stopPolling();
    releaseCanvas();
  },
  onShow() {
    if (!this.data.configured) return;
    void this.load();
    this.startPolling();
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
    requestDraw();
  },

  /** 刷新玩家位置并更新底部信息；失败时保留上一次的位置 */
  async loadPlayers() {
    if (this.data.status !== "ready") return;
    try {
      const result = await homeMapApi().players();
      rt.players = result.players;
      this.setData({
        stale: result.stale,
        onlineCount: result.players.length,
        otherDimensions: result.players.filter((player) => !isOverworld(player.dimension)).map((player) => ({ name: player.name, dimension: dimensionLabel(player.dimension) })),
      });
      this.refreshSelection();
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

  onTouchStart(event: WechatMiniprogram.TouchCanvas) {
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
    } else if (points.length === 1 && previous.length === 1) {
      const dx = points[0]!.x - previous[0]!.x;
      const dy = points[0]!.y - previous[0]!.y;
      this.setView(panBy(view, dx, dy));
      if (gesture.start && touchDistance(points[0]!, gesture.start) > TAP_SLOP_PX) gesture.moved = true;
    }
    gesture.points = points;
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

  /** 点击：优先选中附近的玩家，其次选中所在的领地（land 模块），再次选中所在的区域（area 模块），否则清除选中 */
  handleTap(point: ScreenPoint) {
    const view = rt.view;
    if (!view) return;
    if (rt.showPlayers) {
      const overworld = rt.players.filter((player) => isOverworld(player.dimension));
      const index = hitNearest(view, overworld, point, PLAYER_HIT_RADIUS);
      if (index >= 0) {
        rt.selection = { kind: "player", name: overworld[index]!.name };
        this.refreshSelection();
        requestDraw();
        return;
      }
    }
    if (rt.showRegions) {
      const block = screenToBlock(view, point);
      const land = landAt(rt.landShapes, block.x, block.z);
      if (land) {
        rt.selection = { kind: "land", id: land.shape.land.id, areaIds: land.areas.map((area) => area.id) };
        this.refreshSelection();
        requestDraw();
        return;
      }
      const overworld = rt.regions.filter((region) => isOverworld(region.dimension));
      const index = smallestRegionAt(overworld, block.x, block.z);
      if (index >= 0) {
        rt.selection = { kind: "region", id: overworld[index]!.id };
        this.refreshSelection();
        requestDraw();
        return;
      }
    }
    this.clearSelection();
  },

  /** 按当前数据刷新信息卡；选中的玩家下线或离开主世界时清除 */
  refreshSelection() {
    const selection = rt.selection;
    if (selection?.kind === "player") {
      const player = rt.players.find((item) => item.name === selection.name && isOverworld(item.dimension));
      if (!player) return this.clearSelection();
      this.setData({ selectedTitle: player.name, selectedDesc: `${isMe(player.name) ? "我 · " : ""}主世界 ${Math.floor(player.x)}, ${Math.floor(player.y)}, ${Math.floor(player.z)}` });
      return;
    }
    if (selection?.kind === "region") {
      const region = rt.regions.find((item) => item.id === selection.id);
      if (!region) return this.clearSelection();
      this.setData({ selectedTitle: region.name, selectedDesc: `${regionKindLabel(region.kind)} · ${region.minX}, ${region.minZ} → ${region.maxX}, ${region.maxZ}` });
      return;
    }
    if (selection?.kind === "land") {
      const shape = rt.landShapes.find((item) => item.land.id === selection.id);
      if (!shape) return this.clearSelection();
      const { land } = shape;
      const areaNames = shape.areas.filter((area) => selection.areaIds.includes(area.id)).map((area) => area.name);
      const parts = ["领地"];
      if (land.ownerName) parts.push(`领主 ${land.ownerName}`);
      // 正常状态不占信息卡位置，只提示欠费 / 冻结等异常
      if (land.status && land.status !== "active") parts.push(landStatusLabel(land.status));
      if (areaNames.length) parts.push(`区域 ${areaNames.join("、")}`);
      this.setData({ selectedTitle: land.name, selectedDesc: parts.join(" · ") });
      return;
    }
    if (this.data.selectedTitle) this.setData({ selectedTitle: "", selectedDesc: "" });
  },
  clearSelection() {
    rt.selection = null;
    if (this.data.selectedTitle) this.setData({ selectedTitle: "", selectedDesc: "" });
    requestDraw();
  },

  togglePlayers() {
    rt.showPlayers = !rt.showPlayers;
    this.setData({ showPlayers: rt.showPlayers });
    if (!rt.showPlayers && rt.selection?.kind === "player") this.clearSelection();
    requestDraw();
  },
  toggleRegions() {
    rt.showRegions = !rt.showRegions;
    this.setData({ showRegions: rt.showRegions });
    if (!rt.showRegions && (rt.selection?.kind === "region" || rt.selection?.kind === "land")) this.clearSelection();
    requestDraw();
  },
  /** 开关区块网格 */
  toggleChunks() {
    rt.showChunks = !rt.showChunks;
    this.setData({ showChunks: rt.showChunks });
    requestDraw();
  },

  /** 以屏幕中心为锚点缩放 */
  zoomBy(factor: number) {
    const view = rt.view;
    const meta = rt.meta;
    if (!view || !meta) return;
    this.setView(zoomAt(view, view.scale * factor, { x: view.width / 2, y: view.height / 2 }, scaleLimits(meta)));
  },
  zoomIn() {
    this.zoomBy(ZOOM_BUTTON_FACTOR);
  },
  zoomOut() {
    this.zoomBy(1 / ZOOM_BUTTON_FACTOR);
  },

  /** 复位到初始视图（地图中心 + 建议层级） */
  resetView() {
    const view = rt.view;
    const meta = rt.meta;
    if (!view || !meta) return;
    this.setView(initialViewport(meta, view.width, view.height));
  },

  /** 定位到自己：在线且在主世界时移到自己的位置并选中 */
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
    const limits = scaleLimits(meta);
    const scale = Math.min(limits.max, Math.max(view.scale, LOCATE_MIN_SCALE));
    rt.selection = { kind: "player", name: me.name };
    if (!rt.showPlayers) {
      rt.showPlayers = true;
      this.setData({ showPlayers: true });
    }
    this.setView({ ...view, centerX: me.x, centerZ: me.z, scale });
    this.refreshSelection();
  },

  retry() {
    this.setData({ status: "loading", errorText: "" });
    void this.load();
  },
});
