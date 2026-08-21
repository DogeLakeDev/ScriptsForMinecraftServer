# SFMC tools（monorepo 内部）

本目录是 **仓库私有** 脚本集，**不发布**到 npm。

| 对外能力 | 所在包 |
|----------|--------|
| `sfmc mod install` / fetch-module | `@sfmc-bds/cli` |
| 模块脚手架 `sfmc-new-module` | `@sfmc-bds/devkit` |

## 仓内常用

```bash
npm run verify                 # 平台集成自检（CI）
npx sfmc-esbuild-transpile     # 各包 build
npx tsc7 --noEmit              # typecheck
npm run docs -- serve|build
```

发版走 Changesets：**push `main` → Version Packages PR → 合并后 CI 自动 `ci-release-packages`**。本地一般不手动发。

构建 bin 经 workspace 链接；包内脚本请用 bin 名，勿写 `../../../tools/...`。
