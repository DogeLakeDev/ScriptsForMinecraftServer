/**
 * map-sheet — 浮在地图上、可上下拖动的底部面板（Apple 地图 / 「查找」的 Sheet）
 *
 * 使用场景：玩家端地图页的搜索与列表、选中地点的详情卡、图层开关都放在这个面板里。
 * 三档高度：收起（只露出头部）、中档（可用高度的一半）、全屏（可用高度）。
 * 用法：<map-sheet detent="{{sheetDetent}}" content-key="{{sheetView}}" binddetentchange="onSheetDetent">
 *         <view slot="header">搜索框 / 标题</view> <view slot="accessory">地图控件</view> 正文 </map-sheet>
 * accessory 插槽（可选）放在面板顶边右上方，随面板升降、拉向全屏时淡出（iOS 26 地图右下角的按钮组）。
 * 组件放在页面里一个定位好的区域内（宽高由页面的 .map-sheet-area 决定），面板贴区域底边、高度按档位变化；
 * 只有头部可以拖动，正文为 scroll-view，避免与列表滚动冲突。拖动手势在 sheet.wxs（渲染层）里完成。
 */

/** 面板档位名，按高度从低到高排列；序号与 sheet.wxs 里的 heights 下标一致 */
export type SheetDetent = "collapsed" | "medium" | "full";

/** 档位名与序号互换用的顺序表 */
const DETENTS: SheetDetent[] = ["collapsed", "medium", "full"];

/** 中档占可用高度的比例（Apple 地图的中档约为屏幕一半） */
const MEDIUM_RATIO = 0.5;

/**
 * detentchange / layout 事件的 detail。
 * sheetTop 为面板顶边在窗口坐标系中的 y（px）：页面据此把选中目标移到面板上方的可见区域中间。
 */
export interface SheetLayoutDetail {
  detent: SheetDetent;
  sheetTop: number;
}

Component({
  options: { multipleSlots: true },
  properties: {
    /** 当前档位，由页面控制；用户拖动吸附后触发 detentchange，页面再把新档位写回 */
    detent: { type: String, value: "collapsed" },
    /** 头部内容的标识（如列表 / 地点 / 图层）：变化时重新测量收起高度，并把正文滚回顶部 */
    contentKey: { type: String, value: "" },
  },
  data: {
    /** 传给 sheet.wxs 的布局："收起,中档,全屏,当前档序号"，测量前为空 */
    layout: "",
    /** 正文滚动位置；内容切换时归零 */
    scrollTop: 0,
    /** 当前不是收起档时正文才可滚动 */
    scrollable: false,
  },
  observers: {
    detent() {
      this.measure();
    },
    contentKey() {
      // scroll-top 的值不变时不会触发滚动，在 0 与 0.01 之间切换，保证每次都滚回顶部
      this.setData({ scrollTop: this.data.scrollTop === 0 ? 0.01 : 0 });
      this.measure();
    },
  },
  lifetimes: {
    ready() {
      this.measure();
    },
  },
  methods: {
    /** 测量可用区域与头部高度，生成各档高度并通知页面面板顶边位置 */
    measure() {
      this.createSelectorQuery()
        .select("#area")
        .boundingClientRect()
        .select("#header")
        .boundingClientRect()
        .exec((result) => {
          const area = result?.[0] as WechatMiniprogram.BoundingClientRectCallbackResult | null;
          const header = result?.[1] as WechatMiniprogram.BoundingClientRectCallbackResult | null;
          if (!area || !header || !area.height) return;
          const full = Math.round(area.height);
          const collapsed = Math.min(full, Math.round(header.height));
          const medium = Math.max(collapsed, Math.round(full * MEDIUM_RATIO));
          const index = Math.max(0, DETENTS.indexOf(this.data.detent as SheetDetent));
          const heights = [collapsed, medium, full];
          const layout = `${collapsed},${medium},${full},${index}`;
          const scrollable = index > 0;
          if (layout !== this.data.layout || scrollable !== this.data.scrollable) this.setData({ layout, scrollable });
          const detail: SheetLayoutDetail = { detent: DETENTS[index]!, sheetTop: area.bottom - heights[index]! };
          this.triggerEvent("layout", detail);
        });
    },
    /** sheet.wxs：拖动松手后吸附到某一档 */
    onSettle(payload: { index: number }) {
      const detent = DETENTS[payload.index] ?? "collapsed";
      if (detent === this.data.detent) {
        this.measure();
        return;
      }
      this.triggerEvent("detentchange", { detent });
    },
  },
});
