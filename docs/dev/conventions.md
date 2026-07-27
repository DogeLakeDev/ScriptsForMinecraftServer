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

## 依赖版本（syncpack）

全仓用 [syncpack](https://syncpack.dev/) v15 统一 `package.json` 依赖版本与字段排序。配置见根目录 `.syncpackrc.json`。

```bash
npm run syncpack:lint          # 检查不一致
npm run syncpack:fix           # 对齐版本（两轮：本地 version → ^range）
npx syncpack format            # 排序 package.json 字段
npx syncpack format --check    # CI / 本地检查
```

约定摘要：

- 一般 `dependencies` / `devDependencies` 用 `^`
- 本地 `@sfmc-bds/*` 引用对齐到该包当前 `version`（仍带 `^`，便于 npm 发布；**不要**用 pnpm 的 `workspace:*`，本仓是 npm workspaces）
- SDK 的 `@minecraft/*` **peer** 保持宽范围，不与根仓精确 preview 对齐
- TypeScript 双轨（`npm:` alias）不参与统一

## 构建脚本路径

包内 `build` / `typecheck` 走 `@sfmc-bds/tools` 的 bin（`sfmc-esbuild-transpile`、`tsc7`），不要写 `node ../../../tools/...` 这类随目录深度变化的相对路径。需要编程调用时用 `require.resolve("@sfmc-bds/tools/tsc7")`（SDK 因与 tools 成环，只 resolve 不声明依赖）。

## 注释

新增注释用中文 UTF-8；生成后检查乱码。

## 审查 refactor 时

关注 DRY、OCP、DIP、LSP、最少知识（Demeter）。重复鉴权、重复 lock 读写、在核心 switch 上打洞，优先抽公共层。

## 贡献

- 见 [贡献指南](./contributing.md)（根脚本、环境、仓库规则）
- 尽量不破坏已正确的功能
- 改函数前先读懂原逻辑，增量修改
- 不提交 `configs/`、`data/`、密钥
