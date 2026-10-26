/**
 * tile-cache.ts — 地图瓦片图片的 LRU 缓存与加载队列
 *
 * 使用场景：pages/map 每帧按视口请求瓦片，已加载的直接绘制；同时只并发加载少量图片，按调用方给的顺序（离屏幕中心由近到远）排队。
 * 图片对象由构造参数 createImage 提供（页面传 canvas.createImage），本文件不直接依赖 wx（DIP）。
 */

/** 缓存可接受的图片对象：与小程序 canvas.createImage() 返回的 Image 兼容 */
export interface TileImage {
  src: string;
  onload: (...args: any[]) => any;
  onerror: (...args: any[]) => any;
}

/** 一张待加载的瓦片 */
export interface TileRequest {
  key: string;
  url: string;
}

/** 缓存条目：加载中 / 已加载 / 加载失败（记下失败时间，过一段时间再重试） */
interface TileEntry<T extends TileImage> {
  state: "loading" | "loaded" | "failed";
  image: T;
  failedAt: number;
}

/** 缓存参数 */
export interface TileCacheOptions<T extends TileImage> {
  createImage: () => T;
  /** 有瓦片加载完成（或失败）时回调，页面据此请求重绘 */
  onChange: () => void;
  /** 最多缓存的图片数，超出后按最近最少使用淘汰（当前视口内的不淘汰） */
  limit: number;
  /** 同时加载的图片数上限 */
  parallel: number;
  /** 加载失败（多为该处没有地形、瓦片不存在）后多久才允许重试 */
  retryAfterMs: number;
  now?: () => number;
}

/** 瓦片图片缓存 */
export class TileCache<T extends TileImage> {
  /** Map 的插入顺序即使用顺序：最近用过的移到末尾 */
  private readonly entries = new Map<string, TileEntry<T>>();
  private loading = 0;
  private readonly now: () => number;

  constructor(private readonly options: TileCacheOptions<T>) {
    this.now = options.now ?? Date.now;
  }

  /** 取已加载的图片并标记为最近使用；未加载或失败时返回 null */
  get(key: string): T | null {
    const entry = this.entries.get(key);
    if (!entry || entry.state !== "loaded") return null;
    this.entries.delete(key);
    this.entries.set(key, entry);
    return entry.image;
  }

  /**
   * 按顺序为尚未加载的瓦片发起加载，直到并发达到上限。
   * 已加载、加载中、以及失败后还没到重试时间的瓦片跳过。
   */
  request(wanted: readonly TileRequest[]): void {
    for (const { key, url } of wanted) {
      if (this.loading >= this.options.parallel) return;
      const entry = this.entries.get(key);
      if (entry && (entry.state !== "failed" || this.now() - entry.failedAt < this.options.retryAfterMs)) continue;
      this.load(key, url);
    }
  }

  /** 淘汰超出上限的最久未用条目；keep 中的键（当前视口）与加载中的条目保留 */
  prune(keep: ReadonlySet<string>): void {
    if (this.entries.size <= this.options.limit) return;
    for (const [key, entry] of this.entries) {
      if (this.entries.size <= this.options.limit) return;
      if (keep.has(key) || entry.state === "loading") continue;
      this.entries.delete(key);
    }
  }

  /** 清空缓存（例如服务器重新渲染后需要换掉旧图）；进行中的加载回调会被忽略 */
  clear(): void {
    this.entries.clear();
    this.loading = 0;
  }

  private load(key: string, url: string): void {
    const image = this.options.createImage();
    const entry: TileEntry<T> = { state: "loading", image, failedAt: 0 };
    this.entries.delete(key);
    this.entries.set(key, entry);
    this.loading += 1;
    const settle = (state: "loaded" | "failed") => {
      // clear() 之后到达的回调：条目已不在缓存里，不再计数
      if (this.entries.get(key) !== entry) return;
      this.loading = Math.max(0, this.loading - 1);
      entry.state = state;
      if (state === "failed") entry.failedAt = this.now();
      this.options.onChange();
    };
    image.onload = () => settle("loaded");
    image.onerror = () => settle("failed");
    image.src = url;
  }
}
