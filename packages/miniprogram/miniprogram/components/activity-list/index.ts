/**
 * activity-list — 行为记录列表（点按展开明细）
 *
 * 使用场景：管理端「行为日志」页与玩家端「我的行为记录」页。
 * items 由 core/activity.ts 的 activityItemView 生成；同一时间只展开一条。
 */
Component({
  properties: {
    items: { type: Array, value: [] },
  },
  data: {
    /** 当前展开的记录 ID；空串表示全部收起 */
    openId: "",
  },
  methods: {
    toggle(event: WechatMiniprogram.TouchEvent) {
      const id = String(event.currentTarget.dataset.id);
      this.setData({ openId: this.data.openId === id ? "" : id });
    },
  },
});
