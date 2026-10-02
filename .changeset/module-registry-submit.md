---
"@sfmc-bds/devkit": major
"@sfmc-bds/cli": minor
"@sfmc-bds/create-module": patch
---

增加模块索引预览和一键 PR 提交，共用 npm、Schema、来源与依赖校验，支持重复提交更新及发布后 CI 接入；脚手架提供索引展示配置。

为避免 CLI 与 devkit 循环依赖，devkit 不再隐式安装 CLI。使用重建部署功能的独立 devkit 消费者需另行安装 @sfmc-bds/cli，或配置 SFMC_CLI / cliPath；官方扩展继续自带 CLI。
