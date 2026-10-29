/**
 * glass-tab-bar — iOS 27 悬浮玻璃标签栏（只负责外观与点按）
 *
 * 使用场景：玩家端自定义标签栏 custom-tab-bar（首页 / 地图 / 排行 / 我的）与管理端底部导航 admin-nav
 *（实例 / 控制台 / 任务 / 管理）共用同一套外观。点按时触发 select 事件（detail.key），
 * 怎么切换页面由使用方决定（玩家端 wx.switchTab，管理端 redirectTo）；docked 模式下也用作页面内的分类切换（模块、世界包）。
 * 页面需要在底部让出 --tab-bar-space 的高度（.with-tabbar / .with-admin-nav）。
 */

/** 标签栏的一项 */
export interface GlassTab {
  /** 唯一标识，与 current 比较判断选中 */
  key: string;
  /** 标签文字 */
  text: string;
  /** 未选中时的图标类名（不含 .i- 前缀） */
  icon: string;
  /** 选中时的图标类名，缺省时与 icon 相同 */
  activeIcon?: string;
  /** 图标右上角的角标文字，空表示不显示 */
  badge?: string;
}

Component({
  options: {
    /*
     * 虚拟化组件节点：不生成外层宿主节点，.tab-bar 直接成为父容器的子节点。
     * docked 模式下 .tab-bar 要作为页面 .dock 的 flex 子项撑满宽度（3 项及以上），否则 flex 只作用在宿主节点上、胶囊按文字收缩。
     */
    virtualHost: true,
  },
  properties: {
    /** 标签项列表（GlassTab[]） */
    tabs: { type: Array, value: [] },
    /** 当前选中项的 key */
    current: { type: String, value: "" },
    /**
     * 停靠模式：不再自己固定在屏幕底部，而是放进页面的 .dock 容器，右侧并排一个圆形按钮
     *（iOS 27 Builder Tab Bar 的 Separate Search=True）。使用场景：模块管理、世界包页的底部分类切换。
     */
    docked: { type: Boolean, value: false },
  },
  methods: {
    onTap(event: WechatMiniprogram.TouchEvent) {
      const key = String(event.currentTarget.dataset.key);
      if (key !== this.data.current) this.triggerEvent("select", { key });
    },
  },
});
