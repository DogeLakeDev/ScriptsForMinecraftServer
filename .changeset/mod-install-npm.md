---
"@sfmc-bds/cli": minor
---

feat(tools): `sfmc mod install` 默认走 npm；`--from local` 接受 dir/.tgz/.zip

- `tools/lib/npm-resolver.mjs`：单一权威的 npm 包名解析（短 id / feature-* / core-* / @scope/name）。
- `tools/fetch-module.mjs`：
  - 新增 `npm:` 前缀（`npm install --prefix packages/<id> --omit=dev --no-save` 隔离安装）。
  - 新增 `tgz:` / `zip:` 显式前缀；`local:` 现在接受 dir/`.tgz`/`.zip`，无路径默认 cwd。
  - `fromLocal` 重构为单一入口（resolveLocalPath），避免 dir/tgz/zip 解析分散。
  - zip 安装强制校验内含 `package.json` + `sapi/manifest.json`，缺关键文件硬错误并清理污染目录。
  - tgz 安装委托 `npm install --prefix tmp <tarball>`（不重新发明 tar，零新依赖）。
  - 缺省 source 解析：先看 first-party registry（兼容 `Tanya7z/sfmc-modules`），否则按 `@sfmc-bds/module-<folder>` 走 npm；常见 npm 错误翻译为中文可读 + 下一步动作（404 / EACCES / ERESOLVE / ETIMEDOUT）。
- `tools/install-resolver.test.mjs` + `tools/local-resolver.test.mjs`：表驱动共 16 用例通过。
- 文档：`docs/guide/modules.md` + `docs/dev/module-author.md` 增「安装源」表格，钉死 default 解析顺序。