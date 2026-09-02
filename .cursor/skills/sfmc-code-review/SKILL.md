---
name: sfmc-code-review
description: >-
  Review SFMC PRs and refactors with DRY, OCP, DIP, LSP, and Law of Demeter.
  Report BLOCKER/MAJOR/MINOR tagged by principle; patch high-confidence issues.
  Use when reviewing PRs, 审查, or other agents' changes in this repo.
---

# SFMC Code Review

审查平台包（`packages/*`、`modules/sdk/*`）及同生态 `@sfmc-bds/*` 时，用五原则作硬维度。释义见 [principles.md](principles.md)。

## 流程

1. 定 diff 范围；对照 `AGENTS.md` 与包边界。
2. 按五原则检查；每条标注原则 + 级别。
3. 高置信、可验证的 BLOCKER/MAJOR：直接给最小补丁（或更新 PR）。
4. 用下方模板输出；无问题则写「未发现 BLOCKER/MAJOR」并列出已检面。

文档错别字、单行注释可略过完整报告。

## 五原则（现状期望）

| 原则 | 期望形态 |
|------|----------|
| **DRY** | 鉴权、body 解析、lock/catalog、默认配置各有一处权威实现 |
| **OCP** | 新能力走注册表 / 路由工厂 / 策略，扩展现有表面 |
| **DIP** | 模块经 SDK 公开面；服务包独立；CLI 只编排 |
| **LSP** | 单操作路由与 `/db/tx`、HTTP service 与 `tx.call` 对 moduleId / 权限 / 信封一致 |
| **迪米特** | 模块只经 manifest + service/tx 协作；路由只用文档化的请求契约 |

## 级别

| 级 | 含义 |
|----|------|
| **BLOCKER** | 安全 / 数据 / 契约 / 必炸；合并前修掉 |
| **MAJOR** | 明显原则债；应修或有跟进 |
| **MINOR** | 风格与小范围重复；可择机 |

## 报告模板

```markdown
# 审查：<范围或 PR>

## 结论
<可合并 / 需修 BLOCKER / 建议先处理 MAJOR>

## BLOCKER
### B1. <标题>
- **原则：** DRY | OCP | DIP | LSP | 迪米特
- **位置：** `path:line` 或 symbol
- **证据：** …
- **修复：** <已做补丁 / diff 要点>

## MAJOR
### M1. …

## MINOR
### m1. …

## 已检查
- [ ] 包边界（服务独立；CLI 编排；模块走 SDK）
- [ ] 鉴权 / moduleId / 结果信封（若触及 db-server 或 SDK 客户端）
- [ ] 可发布包 API/行为变更带 changeset
- [ ] 相关测试或 verify
```

## 专项清单（现行契约）

- [ ] `bds-tools` / `db-server` / `qq-bridge` / SDK 可独立调用
- [ ] 模块依赖面：`@sfmc-bds/sdk` + `@minecraft/*`；跨模块经 service/tx
- [ ] SQL 可信标识：`sql()` / `raw()`
- [ ] 玩家消息：`Msg.*`
- [ ] 配置模型：平台 JSON 变更靠重启；运行时 lock 仅 enable/disable
- [ ] 公开 API/行为变更有 changeset；pre 模式发 beta tag
- [ ] `packages/tools` 为仓内私有包

## 相关

`sfmc-onboarding` · `sfmc-module-author` · [principles.md](principles.md)
