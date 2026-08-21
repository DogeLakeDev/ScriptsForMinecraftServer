---
name: sfmc-code-review
description: >-
  Review SFMC PRs and agent refactors using DRY, OCP, DIP, LSP, and Law of
  Demeter. Emit BLOCKER/MAJOR/MINOR findings tagged with the violated
  principle; patch high-confidence verifiable issues. Use when reviewing pull
  requests, code review, 审查, refactor review, or other agents' changes in
  ScriptsForMinecraftServer.
---

# SFMC Code Review

审查本仓（及同生态 `@sfmc-bds/*`）变更时 **必须** 用下列五原则作硬维度。报告格式见下；完整原则释义见 [principles.md](principles.md)。

## 何时用

- 用户要求审查 / review / 看 PR / 复查其他 agent 的重构
- 合并前对平台包（`packages/*`、`modules/sdk/*`）的行为/API 变更做把关

纯文档错别字、单行注释可跳过完整报告，但仍勿引入原则违规。

## 流程

1. 弄清 diff 范围（`git diff` / PR files）；对照相关 `AGENTS.md` 与包边界。
2. 按五原则扫一遍；每条问题标注原则 + 级别。
3. **高置信、可验证** 的 BLOCKER/MAJOR：直接给最小修复补丁（或提/更新 PR）；不要只开空头支票。
4. 输出采用下方模板；无问题写「未发现 BLOCKER/MAJOR」并列出已检查面。

## 五原则（速记）

| 原则 | 违规信号（SFMC 语境） |
|------|----------------------|
| **DRY** | 重复鉴权、重复 body 解析、重复 lock/catalog 读写、同一默认配置多处拷贝 |
| **OCP** | 在核心 `switch`/`if` 链上为新能力打洞，而非注册表/路由工厂/策略扩展 |
| **DIP** | 业务/模块依赖平台内部文件布局或具体 HTTP 细节；服务包依赖 CLI |
| **LSP** | 单操作路由与 `/db/tx`、HTTP `service` 与 `tx.call` 对 moduleId/权限/信封行为不一致 |
| **迪米特** | 模块读他模块私有表/配置；路由依赖 `req` 上未文档化私有缓存字段 |

## 级别

| 级 | 含义 |
|----|------|
| **BLOCKER** | 安全/数据损坏/契约破坏/合并后必炸；必须修 |
| **MAJOR** | 明显原则债或错误抽象，近期会痛；应修或有明确跟进 issue |
| **MINOR** | 风格、命名、可读性、小范围重复；可择机 |

## 报告模板

```markdown
# 审查：<范围或 PR>

## 结论
<一句话：可合并 / 需修 BLOCKER / 建议先处理 MAJOR>

## BLOCKER
### B1. <标题>
- **原则：** DRY | OCP | DIP | LSP | 迪米特
- **位置：** `path:line` 或 symbol
- **证据：** <可验证现象>
- **修复：** <已做补丁 / 建议 diff 要点>

## MAJOR
### M1. …

## MINOR
### m1. …

## 已检查
- [ ] 包边界（cli 不被服务依赖；模块不依赖平台内部）
- [ ] 鉴权 / moduleId / 结果信封一致性（若触及 db-server 或 SDK 客户端）
- [ ] changeset（改动可发布包公开 API/行为时）
- [ ] 测试或 verify 相关影响
```

## SFMC 专项检查清单

- [ ] **包独立性：** `bds-tools` / `db-server` / `qq-bridge` / SDK 可独立调用；禁止服务 → CLI
- [ ] **模块边界：** 只依赖 `@sfmc-bds/sdk` + `@minecraft/*`；跨模块走 manifest + service/tx
- [ ] **DB：** 可信 SQL 标识用 `sql()` / `raw()`，勿把表名塞进普通 `` SQL`…${}` ``
- [ ] **消息：** 无新增 `player.sendMessage()`；用 `Msg.*`
- [ ] **配置：** 无假装「整包热重载」；lock 写入路径唯一
- [ ] **发布：** 公开 API/行为变更有 changeset；`.changeset/pre.json` 存在时勿教发 `latest`
- [ ] **`packages/tools`：** 仓内私有，不发 npm

## 相关

- 进仓上下文 → `sfmc-onboarding`
- 模块作者契约 → `sfmc-module-author`
- 原则展开 → [principles.md](principles.md)
