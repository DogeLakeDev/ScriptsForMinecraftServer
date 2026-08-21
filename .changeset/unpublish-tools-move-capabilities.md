---
"@sfmc-bds/cli": minor
"@sfmc-bds/devkit": minor
"@sfmc-bds/sfmc": patch
---

停发 `@sfmc-bds/tools`：`fetch-module` 迁入 `@sfmc-bds/cli`，`new-module` 迁入 `@sfmc-bds/devkit`；tools 改为 monorepo private（verify/build bins）。meta 不再依赖 tools。发版后请对已发布 beta 执行：

`npm deprecate @sfmc-bds/tools@"*" "Moved: use @sfmc-bds/cli (mod install) and @sfmc-bds/devkit (scaffold)."`
