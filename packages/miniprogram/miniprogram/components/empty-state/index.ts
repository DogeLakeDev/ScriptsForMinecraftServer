/**
 * empty-state — 列表为空时的占位
 *
 * 使用场景：任务、模块、世界包、备份、玩家名单等列表没有内容或筛选无结果时。
 * icon 为语义图标名的连字符形式（对应 styles/icons.wxss 中的 .i-<icon>）。
 */
Component({
  properties: {
    icon: { type: String, value: "info" },
    title: { type: String, value: "" },
    desc: { type: String, value: "" },
    compact: { type: Boolean, value: false },
  },
});
