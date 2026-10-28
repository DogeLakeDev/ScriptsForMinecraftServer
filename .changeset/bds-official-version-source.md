---
"@sfmc-bds/bds-tools": patch
"@sfmc-bds/sdk": patch
---

BDS 更新检查改为优先使用 Mojang 官方下载接口获取最新版本，失败再回退到 Bedrock-OSS 版本列表（GitHub raw 与 jsDelivr 镜像）。修复 GitHub 不可达时只能依赖 jsDelivr 旧缓存，新版本发布初期检查结果时新时旧的问题。Bedrock-OSS 尚未收录新版本或不可达时，改用官方下载地址（跳过哈希校验）。自定义了 `version_versions` 或使用 endstone 模式时行为不变。同时修复 HTTP 请求与下载成功（及重定向、4xx）后未清除超时计时器，导致一次性命令在完成后仍空等至超时才退出的问题。
