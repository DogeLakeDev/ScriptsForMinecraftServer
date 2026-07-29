---
"@sfmc-bds/cli": minor
---

feat(tools): 新增 `tools/verify-module-publish.mjs` pre-publish 守门

- 7 类硬检查（exit 1）：manifest v2 schema / 必填字段 / `package.name` 与 `manifest.id` 折叠一致 / `package.files` 含 `sapi/` / `npm pack` 真实产物 tar 解析（验 `package.json` + `sapi/manifest.json` + `sapi/src/**`）/ 无 `@sfmc/sdk` 旧别名 / 显式声明 `@sfmc-bds/sdk` 依赖。
- 跨模块源码 import 警告（exit 0；不阻塞 publish）：相对路径深挖 ≥ 2 级、未授权模块引用。
- npm pack tar 解析：极简 tar 头解析器（512-byte 块 + null-padded name/size + typeflag）；用 `zlib.gunzipSync` 解 gzip（无新依赖）。
- Windows spawn：直接调 `node npm-cli.js`（不绕 cmd.exe）；合并 stdout + stderr（npm 11+ 把 notice 打到 stderr，tgz 名在 stdout）。
- 复用 `@sfmc-bds/bds-tools/zipx` 已有的同思路（防 zip-slip），不重复发明。
- 测试 `tools/verify-module-publish.test.mjs` 5 cases：模板仓（good fixture）+ 4 个坏 fixture（缺 manifest / 错 schemaVersion / name 不匹配 / 旧别名）。
- sfmc workspace 仍 93/93；全仓 typecheck 干净。
- 单独可跑；CI 可 `node tools/verify-module-publish.mjs` 拦截 publish。