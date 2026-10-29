/**
 * custom-tab-bar — 玩家端自定义标签栏（微信约定的固定路径，app.json 的 tabBar.custom 开启后由框架挂到每个标签页）
 *
 * 使用场景：首页 / 地图 / 排行 / 我的 底部的 iOS 27 悬浮玻璃标签栏，替代原生标签栏（原生标签栏做不了玻璃材质）。
 * 外观在 components/glass-tab-bar；current 由各标签页 onShow 调 selectPlayerTab 写入（见 core/player-tabs.ts）。
 */
import { PLAYER_TABS } from "../core/player-tabs";

Component({
  data: {
    /** 标签项（不含跳转路径，路径在点按时按 key 查找） */
    tabs: PLAYER_TABS.map(({ key, text, icon, activeIcon }) => ({ key, text, icon, activeIcon })),
    /** 当前选中项的 key，由页面同步 */
    current: "",
  },
  methods: {
    onSelect(event: WechatMiniprogram.CustomEvent<{ key: string }>) {
      const tab = PLAYER_TABS.find((item) => item.key === event.detail.key);
      if (tab) wx.switchTab({ url: tab.url });
    },
  },
});
