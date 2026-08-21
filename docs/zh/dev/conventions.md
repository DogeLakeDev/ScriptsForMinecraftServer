# 代码约定

## 消息

用 `Msg.info` / `success` / `error` / `warning` / `tips`。业务代码不要直接 `player.sendMessage()`（ESLint：`no-player-send-message`）。

## 命令与权限

- 聊天：`!命令` / `！命令`
- `Permission.register(name, level)`：Any=0、Member=1、OP=2、Admin=3
- `Command.register` 经 moduleGuard；禁用模块的命令自动拦截

## 配置

- 平台：`configs/*.json` 中由仓顶服务管理的文件（见 `ConfigName`）；SAPI `ConfigManager` 启动时只缓存 `modules` / `settings` / `permissions`。
- 模块：`configs/<configKey>.json`，经 `@sfmc-bds/sdk/sapi/config` 读写，不进 `ConfigName`。
- 改平台配置或直接改磁盘上的模块 JSON → 重启 BDS。运行中 `config.set` 可即时写回模块配置。无整包热更命令。

## 模块边界

- 只依赖 `@sfmc-bds/sdk` + `@minecraft/*`
- 跨模块：manifest 声明 + `service.get` / `tx.call`
- 不读其它模块私有表、不 import 其它模块源码  
  （ESLint：`no-cross-module-source-import`、`no-platform-internal-import` 等）

## Prettier

双引号、`trailingComma: es5`、`printWidth: 120`；Windows 仓常用 `endOfLine: crlf`（见根 `.prettierrc.json`）。

## syncpack（主仓）

```bash
npm run syncpack:lint
npm run syncpack:fix
npx syncpack format --check
```

- `dependencies` / `devDependencies` 一般用 `^`
- 本地 `@sfmc-bds/*` 对齐该包 `version`（仍带 `^`）；禁止 `workspace:*`
- SDK 的 `@minecraft/*` peer 保持宽范围
- TypeScript npm alias 不参与统一

## 构建脚本路径

包内 `build` / `typecheck` 使用 monorepo `@sfmc-bds/tools` workspace 的 `sfmc-esbuild-transpile`、`tsc7`（不发 npm），不要写 `node ../../../tools/...`。

## 注释

中文 UTF-8；生成后检查乱码。注释里不用 markdown 格式。

## 审查

关注 DRY、OCP、DIP、LSP、最少知识。重复鉴权、重复 lock 读写、在核心 switch 打洞，优先抽公共层。

贡献流程见 [贡献指南](./contributing.md)。
