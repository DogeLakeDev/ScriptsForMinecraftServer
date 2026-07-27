---
"@sfmc-bds/bds-tools": minor
"@sfmc-bds/cli": minor
---

\# feat/reactor：为CLI命令添加命令界面和帮助文本

\- 实现了command-surface.ts文件，用于定义CLI命令的规范、通道及可见性规则。

\- 创建了help-text.ts文件，根据命令在argv和REPL模式下的可见性提供帮助文档。

\- 引入了pack-update/index.ts文件，封装了包含必要依赖项和日志记录的包更新功能。

\- 添加了send-target.ts文件，用于在REPL中管理发送目标，包括服务状态和提示符样式。
