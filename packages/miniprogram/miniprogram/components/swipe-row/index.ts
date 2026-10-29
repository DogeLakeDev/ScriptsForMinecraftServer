/**
 * swipe-row — 左滑露出操作按钮的列表行（iOS 列表的 Swipe Actions）
 *
 * 使用场景：模块管理、世界包列表的「卸载」，玩家与权限名单的「编辑 / 删除」，操作不再常驻在行尾，左滑后才出现圆形按钮。
 * 用法：<swipe-row data-id="…" action-icon="trash" action-label="卸载" bindaction="uninstall"> 行内容 </swipe-row>，
 * 多个按钮时传 actions="{{[SwipeAction…]}}"，由 event.detail.key 区分；
 * 点按按钮时收起并触发 action 事件；页面处理函数照常从 event.currentTarget.dataset 取 data-* 参数。
 * 拖动手势在 swipe.wxs（渲染层）里完成，这里只负责测量操作区宽度、展开状态与「同一时间只展开一行」。
 */

/**
 * 多操作模式下的一个按钮（actions 属性的元素）。
 * 使用场景：玩家与权限名单的「编辑 + 删除」。
 */
export interface SwipeAction {
  /** 点按时随 action 事件的 detail.key 传给页面 */
  key: string;
  /** 图标名，对应 .i-<icon> */
  icon: string;
  /** danger 为红底，缺省为中性灰底 */
  tone?: string;
  /** 无障碍朗读的按钮名称 */
  label: string;
  /** 置灰但仍可点按 */
  disabled?: boolean;
}

/** 行实例对外只需暴露的部分：是否展开、收起方法（供 onTouchStart 收起其他行） */
interface SwipeRowHandle {
  data: { opened: boolean };
  close(): void;
}

/** 当前存活的行实例。开始滑动某一行时收起其他已展开的行。 */
const rows = new Set<SwipeRowHandle>();

Component({
  properties: {
    /** 操作按钮的图标名，对应构建脚本生成的图标类 .i-<icon> */
    actionIcon: { type: String, value: "trash" },
    /** 按钮语气：danger 为红底，其余为中性灰底 */
    actionTone: { type: String, value: "danger" },
    /** 无障碍朗读的按钮名称 */
    actionLabel: { type: String, value: "删除" },
    /** 按钮置灰但仍可点按（由页面提示不可执行的原因，与原先行尾置灰按钮的行为一致） */
    actionDisabled: { type: Boolean, value: false },
    /** 多个操作按钮（SwipeAction[]）；非空时取代上面的单个 action-* 属性 */
    actions: { type: Array, value: [] },
    /** 完全禁止左滑（没有操作权限时） */
    disabled: { type: Boolean, value: false },
    /** 是否在行顶部画分隔线（列表第一行不画） */
    divider: { type: Boolean, value: false },
  },
  data: {
    /** 操作区宽度（px），传给 swipe.wxs 作为最大左移距离 */
    actionsWidth: 0,
    /** 每次加一通知 swipe.wxs 收起 */
    resetSignal: 0,
    /** 已展开：显示遮罩，点按内容只收起 */
    opened: false,
  },
  observers: {
    "actionIcon, actions, disabled"() {
      this.measure();
    },
  },
  lifetimes: {
    attached() {
      rows.add(this);
    },
    ready() {
      this.measure();
    },
    detached() {
      rows.delete(this);
    },
  },
  methods: {
    /** 测量操作区宽度；禁用时宽度记为 0，swipe.wxs 不再跟手 */
    measure() {
      this.createSelectorQuery()
        .select("#actions")
        .boundingClientRect((rect) => {
          const width = this.data.disabled || !rect ? 0 : Math.round(rect.width);
          if (width !== this.data.actionsWidth) this.setData({ actionsWidth: width });
        })
        .exec();
    },
    /** swipe.wxs：手指按下任意一行时收起其他已展开的行 */
    onTouchStart() {
      for (const row of rows) if (row !== this && row.data.opened) row.close();
    },
    /** swipe.wxs：松手后停在展开位置 */
    onOpen() {
      if (!this.data.opened) this.setData({ opened: true });
    },
    /** swipe.wxs：松手后回到收起位置 */
    onClose() {
      if (this.data.opened) this.setData({ opened: false });
    },
    /** 收起：点按遮罩、点按操作按钮、其他行开始滑动时 */
    close() {
      this.setData({ opened: false, resetSignal: this.data.resetSignal + 1 });
    },
    /** 点按操作按钮：收起并触发 action；多操作模式下 detail.key 为按钮的 key，单个操作时为空字符串 */
    onAction(event: WechatMiniprogram.TouchEvent) {
      this.close();
      this.triggerEvent("action", { key: String(event.currentTarget.dataset.key ?? "") });
    },
  },
});
