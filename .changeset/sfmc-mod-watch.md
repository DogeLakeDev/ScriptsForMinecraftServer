---
"@sfmc-bds/cli": minor
---

feat(sfmc): 新增 `mod watch` 与 `mod test` 子命令

- `sfmc mod watch [--from local[:path]] [--no-reload]`：监听 `sapi/src/**` 变更，~200ms 防抖后复用 `mod reload` 同一路径（build → deploy → 直写 BDS stdin 发 `reload`）。改 `sapi/manifest.json` / `sapi/tsconfig.json` 仅提示「SAPI 启动期缓存，请重启 BDS 进程」。
- `sfmc mod test [--from local[:path]] [-- <args>]`：解析 `--from local[:path]`，spawn `npm test` 透传 stdio，让模块仓的 `scripts.test` 自己决定怎么跑。
- 进程探测复用 `queryServicesRuntime` + `probeBdsStatus`（与 `mod reload` 同源），不另写一遍 reload 路径。
- i18n：新增 `watch.*` / `help.module.watch|test` 中英文案。
- 模板仓源文件已暂存 `docs/dev/sfmc-module-template/`（待推到 `Tanya7z/sfmc-module-template`）。
- 测试：sfmc workspace `npm test` 77/77 通过（含新增 6 个 watch resolver 表驱动用例）。
