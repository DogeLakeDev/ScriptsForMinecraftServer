---
"@sfmc-bds/desktop": minor
"@sfmc-bds/sdk": patch
---

Desktop 在「开发工具」中内置 UI Studio，编辑器随客户端打包，无需连接实例即可离线使用；切换页面或实例时保留编辑状态，支持命令面板与 Ctrl+9 入口。

UI Studio 改用编辑器内的输入、确认和提示弹窗，修复 Electron 中新建工程、重命名页面与自定义绑定无法使用的问题。

将桌面的 SnowUI 令牌、字体、Phosphor 图标与 Base UI 控件提取为内部公共 UI 层。UI Studio 复用同一套按钮、输入、选择器、菜单和对话框；嵌入时跟随桌面外观，并按 app/pages/components/lib/store/styles 分层整理界面代码。
