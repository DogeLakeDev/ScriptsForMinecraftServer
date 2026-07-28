---
"@sfmc-bds/cli": minor
"@sfmc-bds/sdk": patch
---

feat(tools): 脚手架转向 cwd 单包根（与 Tanya7z/sfmc-module-template 同构）

- `tools/new-module.mjs`：
  - 默认（缺省 `--root`）：写到 **cwd** 作为单包根（包根 = 包仓库根），生成自包含 `package.json` + 自包含 `sapi/tsconfig.json` + `$schema` 指向 `node_modules/@sfmc-bds/sdk`。
  - `--root <path>` / `SFMC_MODULES_ROOT` 显式 legacy 模式：仍写到 `<root>/packages/<id>`（兼容旧 sfmc-modules 工作区）。
  - 拒绝 `--root` 指向主仓 `modules/packages`（那是 install 落点，不是开发工作区）。
  - 终端打印「模式: cwd 单包根 / legacy 工作区」+ 各自的下一步命令。
- `tools/scaffold-redirect.test.mjs`：5 cases 表驱动（cwd 单包 / legacy / 拒主仓 / 缺 packages / env fallback）。
- i18n：`modwiz.genPackage` / `modwiz.skeletonWritten` 等改为 cwd 友好文案。
- 文档：上一轮 `module-author.md` 已写明 `sfmc module create` 在模块仓根执行 + `--from local --link` 装入主仓；本 PR 落地脚手架默认行为。