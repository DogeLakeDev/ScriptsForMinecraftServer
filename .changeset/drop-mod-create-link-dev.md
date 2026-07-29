---
"@sfmc-bds/cli": minor
---

feat(sfmc): 移除 `mod create` / `mod link` / `mod dev` 三个遗留子命令；为 `mod install` 注册 `i` 短别名（与 `packs i` 对称）

破坏性变更（CLI 子命令级别）：

- 删除 `sfmc module create` / `sfmc mod create` 子命令（spec + dispatch + help + i18n）。
  推荐用法：`node tools/new-module.mjs <id>` 或直接 clone `Tanya7z/sfmc-module-template` 派生仓。
- 删除 `sfmc module link` / `sfmc mod link` 子命令。`--link` 旗标本身保留，
  使用 `sfmc mod install <id> --from <dir> --link` 即可（这就是之前 `mod link` 内部的转发）。
- 删除 `sfmc module dev` / `sfmc mod dev` 子命令（仅是文本提示）。

新增：

- `sfmc mod i <id>` 现在与 `sfmc -p i` 等价走 `mod install`（对称 packs 子命令的 `i` 别名）。
- `sfmc install <id>` --from <source>`：新增 scheme 预检（`npm:` / `local[:<path>]` / `tgz:` / `zip:` / `dir:` / `github:` / 裸目录），
  拼写错误立即在 sfmc 侧红字提示，不再延迟到子进程 die。

清理：

- `sfmc/src/module-wizard.ts` 整个删除（只剩三个被移除的 wizard + 内部 `runFetchModuleLink`）。
- `i18n`：`modwiz.*` / `help.module.{create,link,dev}` / `mod.linkNeedsFrom` 全部移除；
  新增 `mod.fromUnknown`（scheme 预检错误文案）+ `mod.install.usage` 补 `--sha256`。
- 文档：`docs/dev/{index,tools,module-author,platform}.md`、`docs/superpowers/specs/...` 同步更新。
- 测试：`sfmc/command-surface.test.mjs` 删除 `create 需 TTY` 测试；
  `childTokens.includes("create")` 改为 `includes("uninstall")` + 三个 NOT-IN 断言（`create/link/dev`）。

无 API/契约破坏：行为包协议、模块 manifest schema、SDK exports、catalog/lock 格式均未改动。
