# 代码约定

## 消息

用 `Msg.info/success/error/warning/tips()`，前缀和音效已包好。业务代码别直接 `player.sendMessage()`。

## 命令与权限

- 聊天命令：`!命令名` / `！命令名`
- `Permission.register(name, level)`：Any=0、Member=1、OP=2、Admin=3
- `Command.register` 内部会走 moduleGuard，禁用的模块命令自动拦掉

## 配置

JSON 文件，SAPI 启动缓存。改配置 → 重启 BDS。没有热更命令。

## 模块边界

- 只依赖 `@sfmc-bds/sdk` + `@minecraft/*`
- 跨模块：manifest 声明 + `service.get` / `tx.call`
- 不读别的模块私有表、不 import 别的模块源码

## Prettier

双引号、`trailingComma: es5`、`printWidth: 120`，Windows 仓常用 `endOfLine: crlf`。

## 注释

新增注释用中文 UTF-8；生成后检查乱码。

## 审查 refactor 时

关注 DRY、OCP、DIP、LSP、最少知识（Demeter）。重复鉴权、重复 lock 读写、在核心 switch 上打洞，优先抽公共层。

## 贡献

- 尽量不破坏已正确的功能
- 改函数前先读懂原逻辑，增量修改
- 不提交 `configs/`、`data/`、密钥
