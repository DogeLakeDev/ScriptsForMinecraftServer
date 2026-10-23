# @sfmc-bds/desktop

## 0.3.6(1)

- 配置文件名和路径单行省略显示，悬停可查看完整路径，配置列表不再横向滚动。
- 配置仅保存文件；模块安装、启停、卸载及世界包导入、启停不再自动停止或重启服务，页面提供独立的手动重启按钮。
- 修复弹窗表单的下拉选项被遮挡、无法点击的问题。
- 维护任务与平台升级不再自动创建全量快照，改为「更新与备份」中的手动备份；恢复备份也不额外备份。
- 手动备份完成后恢复原先运行的服务，复制失败时清理本次不完整快照并恢复服务。
- 小修复使用独立构建号，产品版本保持 0.3.6；客户端按构建号检查更新。

## 0.3.6

### Patch Changes

- 远程连接上传平台时显示进度。配置和玩家权限有未保存修改时，离开前需要确认。控制台发送中避免连发，更新页可以刷新备份列表。实例设置按钮留在圆角行内。
- 安装模块不再停止服务器，装完后重建行为包并热重载。模块列表的版本改为读取各模块 package.json。
- Updated dependencies
  - @sfmc-bds/ui@0.1.1

## 0.3.5

### Patch Changes

- d18e066: 玩家页的允许名单改为展示绑定记录，包括玩家名、XUID、QQ 通道和绑定时间。名单只读，不写回原版允许名单。
- 3da94b8: 实例行与侧栏导航对齐：类型图标在名称前，状态灯在行尾。
- d18e066: 打开实例后直接管理，不再要求确认接入。空目录仍进入一次初始化。
- d18e066: 日志控制台按与命令行相同的规则高亮关键词。
- d18e066: 运行指标写入数据库。服务未运行时仍可查看已有曲线，并增加「一天」范围。
- Updated dependencies [d18e066]
- Updated dependencies [d18e066]
  - @sfmc-bds/management@0.3.3

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
