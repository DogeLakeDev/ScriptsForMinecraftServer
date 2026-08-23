# SFMC tools（monorepo 内部）

本目录是 **仓库私有** 脚本集，**不发布**到 npm。

| 对外能力 | 所在包 |
|----------|--------|
| `sfmc mod install` / fetch-module | `@sfmc-bds/cli` |
| 模块脚手架 `npm create @sfmc-bds/module` | `@sfmc-bds/create-module` |

## 仓内常用

```bash
pnpm run verify
npm run verify
pnpm exec sfmc-esbuild-transpile
npx sfmc-esbuild-transpile
pnpm exec tsc7 --noEmit
npx tsc7 --noEmit
pnpm run docs -- serve
npm run docs -- serve
pnpm run docs -- build
npm run docs -- build
```

发版走 Changesets：**push `main` → Version Packages PR → 合并后 CI 自动 `ci-release-packages`**。本地一般不手动发。

构建 bin 经 workspace 链接；包内脚本请用 bin 名，勿写 `../../../tools/...`。
