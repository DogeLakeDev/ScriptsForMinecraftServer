---
"@sfmc-bds/cli": minor
---

feat(sfmc): 新增 `sfmc mod publish` 保姆式 CLI

- 流水线：npm whoami 检测 → scope 推断（默认 `<npm-username>`）→ dry-run 预检 → version bump → `npm publish` 透传 → 薄 index PR（占位）。
- 错误翻译（npm 原文 → 中文 + 下一步动作）：`ENEEDAUTH` / `EOTP` / 邮箱未确认 / 无权限 publish / 402 Payment / 包名太接近 / `ERESOLVE` / `ETIMEDOUT` / 默认透传。
- dry-run 预检三件套：manifest v2 schema、package.json#files 含 `sapi/`、`npm pack --dry-run` 解析 tarball 文件清单。
- version bump：`patch` / `minor` / `major` / `custom <x.y.z[-prerelease]>`；写入 `package.json#version`，**不改** manifest；publish 失败时回滚 bump。
- scope 模型：作者发自己 scope（`@<username>/sfmc-module-<id>`）；**不**触碰 `@sfmc-bds/*`（与 `mod install` 隔离）。
- 薄 index PR：当前为占位（`gh api` 真实调用需 `gh auth login` + 远端 `sfmc-modules` 仓；保留 `--skip-index-pr` 选项）。
- Windows 兼容：`spawn npm.cmd` 通过 `cmd /c npm`（避开 DEP0190 安全警告 + `shell:true` 隐患）。同步修复 `cmdModuleTest` 同样问题。
- 测试：`module-publish.test.mjs` 8 cases（parsePublishFlags / bumpSemver / 错误翻译表 / runPrecheck / defaultScopeFor）；sfmc workspace 85/85 通过。
- i18n：`publish.*` 中英文案 + `help.module.publish` 子命令描述。

> CLI 是 `npm publish` 的编排器 + 检查器 + 错误翻译；**不**替身 npm 行为。所有鉴权（`npm login --auth-type=web` / 2FA / 邮箱确认）走 npm 本身。