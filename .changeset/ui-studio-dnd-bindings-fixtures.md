---
"@sfmc-bds/sdk": minor
---

UI Studio 切片 3：拖放组件库 + 数据绑定选择器 + 预览场景管理。

- 拖放：左栏新增组件库面板（12 种节点 + 图标 + 合理默认值），HTML5 DnD 拖入画布任意位置（兄弟前/后插入线、when/each 槽位落点、body 末尾追加），画布内节点可拖动重排或跨容器移动（禁止移入自身后代，同容器后移自动修正下标）；拖入输入组件时自动补齐 state 声明、each 自动补 load 占位，避免页面因未声明引用立即失验。
- 数据绑定选择器：bind/source 字段改为 Headless UI Listbox，按 状态/参数/数据源/计算值/玩家 分组展示候选路径（bind 契约限定 state.*），支持自定义路径录入；失验引用仍由诊断区兜底。
- 预览场景：基础 fixture 之外支持 `.ui-studio/fixtures/<name>.json` 多场景（新建复制基础 fixture、重命名/移动、删除，中文名可用），画布顶部 Listbox 切换场景并重建预览会话，树中标注「使用中」。
- 修复与打磨：页面失验时选中不再被守卫弹走，Inspector 退化为整文件 JSON 编辑器以便修复；画布空态提示区分「失验」与「无页面」；原生控件主题化（color-scheme、WebKit/Firefox 滚动条、select 自定义箭头与弹出项配色、checkbox accent-color）。
