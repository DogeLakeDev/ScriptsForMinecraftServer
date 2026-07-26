---
"@sfmc-bds/sdk": patch
"@sfmc-bds/cli": patch
---

fix(logs/config): BDS 级别解析 DRY 到 SDK；剥前缀后勿误判 Error；readJson 剥 BOM；log-filter 走 ensureSchemaConfig
