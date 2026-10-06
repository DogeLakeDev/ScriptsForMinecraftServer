# @sfmc-bds/desktop

## 0.3.1

### Minor Changes

- faa4d6d: 桌面端增加托盘与开机启动，可在客户端设置中开关。

## 0.2.0

### Minor Changes

- 21a5efd: Desktop 在「开发工具」中内置 UI Studio，编辑器随客户端打包，无需连接实例即可离线使用；切换页面或实例时保留编辑状态，支持命令面板与 Ctrl+9 入口。

  UI Studio 改用编辑器内的输入、确认和提示弹窗，修复 Electron 中新建工程、重命名页面与自定义绑定无法使用的问题。

  将桌面的 SnowUI 令牌、字体、Phosphor 图标与 Base UI 控件提取为内部公共 UI 层。UI Studio 复用同一套按钮、输入、选择器、菜单和对话框；嵌入时跟随桌面外观，并按 app/pages/components/lib/store/styles 分层整理界面代码。

### Patch Changes

- @sfmc-bds/management@0.3.0
- @sfmc-bds/ui@0.1.0

## 0.1.2

### Patch Changes

- 6bc2e42: 显示平台和桌面发行日志，并在关于入口提示桌面更新。抽屉避开系统标题栏，服务总览支持重启全部服务，修复任务通知进度条和任务时间线显示。
- Updated dependencies [6bc2e42]
  - @sfmc-bds/management@0.3.0

## 0.1.1

### Patch Changes

- Updated dependencies [7aa43b0]
- Updated dependencies [a065cc4]
- Updated dependencies [a065cc4]
  - @sfmc-bds/management@0.2.0
