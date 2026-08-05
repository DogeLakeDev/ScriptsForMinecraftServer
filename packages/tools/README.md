# SFMC dev tools - testing before build

开箱自检、模块安装、冒烟等脚本。面向 monorepo / 已部署的 SFMC 根目录使用。

## 安装

```bash
npm install @sfmc-bds/tools
```

从 npm 安装到非 monorepo `tools/` 路径时，请设置 `SFMC_ROOT` 指向 SFMC 根目录。

## 常用命令

```bash
npx sfmc-check-ootb
npx sfmc-fetch-module search
npx sfmc-catalog-sync
npx sfmc-esbuild-transpile [--dts]   # 各包 `npm run build` 用（勿写 ../../../tools/...）
npx tsc7 --noEmit                    # TS7 typecheck / emit
```

或在仓库根：`npm run check-ootb` / `node packages/tools/check-ootb.mjs`。

包内脚本应走 bin（`sfmc-esbuild-transpile` / `tsc7`），不要写相对仓库布局的 `node ../tools/...`。

npm 包只发布上述 bin + `lib/`（不含 changeset / docs / pack-verify 等 monorepo 基建脚本；那些仍在仓库 `packages/tools/` 供 CI 调用，发版共用库为 `changeset-release-lib.mjs`）。

## 源代码约定

本目录的 `.mjs` 脚本保持 Node 直跑（不走 `tsx`），但 IDE/类型检查通过 `// @ts-check` + JSDoc 注解获得：

- **文件首部**：`#!/usr/bin/env node` 之后紧跟 `// @ts-check`，再放文件说明注释块。`@ts-check` 是 TS7 pragma，不影响 `node` 直接执行。
- **导出函数 / 常量**：缺 JSDoc 会让 `tsc7 --checkJs` 推断为 `any`，**禁止**在 lib 下的导出符号上省略 `@param`/`@returns`/`@type`。
- **不要新增 `tools/*.js`**：历史教训，根 `package.json` 无 `"type": "module"` 时裸 `import` 会炸。所有脚本一律 `.mjs`。
- 顶层脚本（无 `export`）不强求类型注解；`@ts-check` 主要捕获参数误用、未捕获的 `await` 等基础错误。
- 校验：`npm run typecheck --workspaces` 不覆盖本目录。如需手动校验，参考未来新增的 `tsc7 --checkJs --allowJs -p tools/.tsconfig-check.json`（临时调通后可清理）；日常 PR review 关注本目录 diff 即可。

## 仓库

<https://github.com/DogeLakeDev/ScriptsForMinecraftServer/tree/main/tools>
