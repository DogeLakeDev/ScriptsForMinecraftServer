# SFMC tools（monorepo 内部）

本目录是 **仓库私有** 脚本集，**不发布**到 npm。

| 对外能力 | 所在包 |
|----------|--------|
| `sfmc mod install` / fetch-module | `@sfmc-bds/cli` |
| 模块脚手架 `sfmc-new-module` | `@sfmc-bds/devkit` |

## 仓内常用

```bash
npm run verify                 # 平台集成自检（CI）
npm run catalog-sync
npm run check-modules
npx sfmc-esbuild-transpile     # 各包 build
npx tsc7 --noEmit              # typecheck
npm run docs -- serve|build
```

构建 bin 经 workspace 链接到根 `node_modules/.bin/`；包内脚本请用 bin 名，勿写 `../../../tools/...`。

## 约定

- 脚本一律 `.mjs` + `// @ts-check`
- changeset / docs / pack-verify 等发版基建也在此目录，仅 CI / 维护者使用
