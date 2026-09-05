# 官方模块 Prompt Suite 索引

本目录把「分层提示词体系」持久化为可复用资产，用于按波次高质量开仓 **19 个可实现官方模块**（`daily-task` 搁置）。  
**行为权威仍是** `docs/superpowers/specs/modules/*-design.md` + [AGENT_BRIEF.md](../specs/modules/AGENT_BRIEF.md)；提示词不新增契约。

## 怎么生效 / 怎么用

| 资产 | 路径 | 用法 |
|------|------|------|
| 全局架构守护 | `.cursor/rules/sfmc-module-architecture.mdc` | `alwaysApply: true`，Cursor 在本仓会话自动注入；与既有 standing / source-of-truth rules 并存 |
| 开工通用模板 | `.cursor/skills/sfmc-module-kickoff/SKILL.md` | 对 Agent 说「按 sfmc-module-kickoff 实现 `<id>`」，或把 skill 内模板填空后粘贴 |
| Wave A（5） | [wave-a.md](./wave-a.md) | 复制目标模块代码块整段发给 Agent |
| Wave B（6） | [wave-b.md](./wave-b.md) | 同上 |
| Wave C（8 + deferred） | [wave-c.md](./wave-c.md) | 同上；跳过 `daily-task` |
| 自检验收 | [self-check.md](./self-check.md) | 模块实现后粘贴；审查规范指向 `sfmc-code-review` |

## 推荐开仓顺序

1. 确认 AGENT_BRIEF「平台前置 / 开仓闸门」（进程内 `service.provide` + 本地优先 `service.call`）已满足。
2. Wave A → B → C；同波次可按依赖图并行，但不得跳过本模块 `requires`。
3. 每个模块：脚手架（`--official`）→ 专属提示词 → Acceptance criteria → `pnpm run typecheck` + `pnpm test` → [self-check.md](./self-check.md)。

## 相关权威

- 规格索引：`docs/superpowers/specs/modules/README.md`
- 作者面工具链：`.cursor/skills/sfmc-module-author`
- 代码审查：`.cursor/skills/sfmc-code-review`
