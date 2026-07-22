# 工具脚本

根目录 `tools/*.mjs`，配合 `npm run` 使用。

## 常用

| 命令 | 作用 |
|------|------|
| `npm run check-ootb` | 开箱自检（Node 版本、文件、db 健康、sim-new-user） |
| `npm run catalog-sync` | 扫 packages → 写 `catalog.json`，修剪孤儿 lock |
| `npm run check-modules` | 校验 catalog + v2 manifest（空 catalog 合法） |
| `node tools/fetch-module.mjs search` | 查注册表 |
| `node tools/fetch-module.mjs install <id>` | 安装模块 |
| `npm run smoke-modules` | 模块 API 冒烟（需 live db-server） |
| `node tools/sim-new-user.mjs` | 隔离 `SFMC_ROOT` 测试 |
| `node tools/test-db-api.mjs` | 临时端口测 db API |

## fetch-module

```bash
node tools/fetch-module.mjs install afk
node tools/fetch-module.mjs install foo --from github:owner/repo@tag
node tools/fetch-module.mjs install foo --from dir:/path
node tools/fetch-module.mjs install foo --from local:/path.zip
node tools/fetch-module.mjs uninstall afk
```

默认注册表：`Tanya7z/sfmc-modules@main/index.json`，缓存 `tools/.sfmc-registry-cache.json`。

## 共享库

`tools/lib/`：`catalog.mjs`、`packages.mjs`、`lock.mjs`、`paths.mjs`、`http.mjs`、`io.mjs`、`proc.mjs`。

写新工具请复用，别另写一套读写规则。

## 已废弃

不要用：`check-ootb.js`、`check-catalog.js`、`emit-manifest.mjs`、`modules/_manifests/`。

## CI 对应

`ootb.yml` → `check-ootb.mjs` + `smoke-modules.mjs`。本地对齐：

```bash
npm run check-ootb
# 另终端: SFMC_ROOT=$PWD node db-server/dist/index.js
npm run smoke-modules
```
