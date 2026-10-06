# SFMC 公共 UI

`@sfmc-bds/ui` 是 Desktop 与 UI Studio 共用的内部界面基础层。它从桌面渲染层提取 SnowUI 颜色与字体、Phosphor 语义图标、Base UI 控件、菜单、对话框和提示；不依赖 Electron、Monaco 或管理协议。

组件位于 `src/components`，业务无关工具位于 `src/lib`，样式位于 `src/styles`。颜色只在 `src/theme.ts` 定义，消费端负责外观偏好、系统监听及宿主同步。Desktop 的原组件路径保留为转导出入口。

此包不发布到 npm；Vite 从源码导出构建并打入两端的静态资源。添加图标或调整基础控件时修改这里，并运行 `pnpm --filter @sfmc-bds/ui typecheck`、Desktop 与 UI Studio 的类型检查和构建。Studio 的文件格式、草稿、预览求值与 IndexedDB 存储属于编辑器领域，不进入公共 UI 层。

代码沿用桌面平台的 AGPL-3.0-only 许可证，详见仓库根目录 `LICENSE`。SnowUI Dashboard UI Kit（ByeWind）视觉参考按 CC BY 4.0 署名。
