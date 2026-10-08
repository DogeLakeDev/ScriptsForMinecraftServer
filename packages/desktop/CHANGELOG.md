# @sfmc-bds/desktop

## 0.3.4

### Patch Changes

- fe9ab2e: 控制台关闭自动换行时按内容宽度滚动，避免长行被 content-visibility 裁切后无法横向拖动。
- 56aa99e: 实例状态灯移到侧栏右侧，实例名称与侧栏其余文字左对齐。
- Updated dependencies [fe9ab2e]
  - @sfmc-bds/management@0.3.2
  - @sfmc-bds/ui@0.1.0

## 0.3.3

### Patch Changes

- a88942f: 点击告警后打开日志控制台，并定位到对应行高亮。
- 734d87d: 日志控制台按剩余高度排版，整页不再滚动。
- 7b601f6: 运行指标增加内存与维度实体曲线。内存按主机总占用、BDS 和数据服务分色；维度实体按维度分色。
- 1946e4c: 模块更新跳过已收编至平台的模块，例如 monitor。
- Updated dependencies [7b601f6]
  - @sfmc-bds/management@0.3.1

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
