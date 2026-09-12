---
"@sfmc-bds/sdk": minor
"@sfmc-bds/cli": minor
---

UI Studio 切片 2：项目化改造 + 可视化编辑能力。

- 项目化：`sfmc ui studio` 不再依赖模块目录，服务端简化为纯静态托管（去令牌/API）；项目存于浏览器 IndexedDB，支持多项目新建/打开/重命名/删除，zip 整包导入导出（fflate），导入时自动提取根级 manifest.json 的 services 清单。
- 编辑能力：属性面板可直接编辑 feature/页面/组件字段，整表 prev/next 撤销重做栈（Ctrl+Z / Ctrl+Shift+Z），600ms 防抖自动持久化；页面文件支持新建/重命名/复制/删除并自动同步 feature.screens 引用，未知字段原样保留。
- 交互层：引入 @headlessui/react（动作预览弹层改造为 Dialog，焦点陷阱 + ESC 关闭）与 lucide-react 图标；新增顶栏「文件/编辑」下拉菜单（Headless UI Menu）与页面树右键菜单。
- 修复：编辑器拆分为装载器 +  keyed 内层编辑器，杜绝「空文件表初始化草稿后被误持久化覆盖项目数据」的窗口；Inspector 文本/数字字段在外部值变化（撤销/重做）时正确同步。
