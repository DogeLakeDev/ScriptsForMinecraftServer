---
"@sfmc-bds/cli": patch
---

检查更新与安装可使用国内 npm 源：`configs/runtime.json` 新增 `npm_registry`（环境变量 `SFMC_NPM_REGISTRY` 可覆盖），平台版本检查和模块 dist-tag 检查同时请求该源与 npm 官方源，取先返回的结果；平台升级与模块安装的 pnpm add 先用该源，失败时自动改用官方源重试。官方模块索引改为同时请求 GitHub 与 jsDelivr，GitHub 超时时不再拖慢模块检查。
