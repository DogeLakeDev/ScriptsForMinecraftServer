---
name: sfmc-module-kickoff
description: >-
  SFMC 官方业务模块开工模板：按 design.md + AGENT_BRIEF 脚手架实现单模块（manifest v2、
  ModuleRegistry、defineTable、service.provide、Acceptance criteria、typecheck/test）。
  在用户要求实现某个官方模块、开仓、按 Wave 落地，或粘贴模块开工提示词时使用。
---

# SFMC 官方模块开工模板

行为权威：`docs/superpowers/specs/modules/<id>-design.md`。  
共用契约：`docs/superpowers/specs/modules/AGENT_BRIEF.md`。  
分波次专属提示：`docs/superpowers/prompts/`。  
全局铁律：`.cursor/rules/sfmc-module-architecture.mdc`。

**禁止**：移植旧 archive；在 SDK 进程内 `service.provide` / 本地优先 `service.call` 未就绪时强行验收依赖 RPC 的并行实现（见 AGENT_BRIEF 开仓闸门）。

## 填空即用提示词

将 `{module_id}` / `{upstream_dependencies}` 替换后发给 Agent：

```markdown
请帮我根据设计规范实现官方业务模块：`{module_id}`。

【核心事实来源】：
1. 模块设计规范：docs/superpowers/specs/modules/{module_id}-design.md
2. 架构通用简报：docs/superpowers/specs/modules/AGENT_BRIEF.md
3. 上游依赖模块（如有）：{upstream_dependencies}

【执行步骤要求】：
1. 校验与创建目录结构：
   - `sapi/manifest.json`：依据规范声明 schemaVersion: 2, id, configKey, permissions, services.provides, services.requires。
   - `sapi/src/index.ts`：通过 `ModuleRegistry.register` 导出，完整实现规范要求的生命周期函数。
2. 数据表与配置：
   - 如果有数据库表，在 `init` 中使用 `db.defineTable` 声明 `sfmc_<id>_*` 表结构并建索引（短名中 `-` 按既有规格落为 `_`）。
   - 如果有私有配置，定义 TypeScript 强类型接口并通过 `config.get` / `config.watch` 消费。
3. 业务与服务实现：
   - 在 `services.provides` 中实现并注册所有对外 RPC 服务（通过 `service.provide`）。
   - 严格遵循规范中的 Goal、Non-goals 和错误处理边界。
4. 验证与验收：
   - 对照设计规范第 8 节（Acceptance criteria；gui 见第 9 节）逐项检查功能完整性。
   - 运行 `pnpm run typecheck` 和 `pnpm test` 保证零类型错误、零测试失败。
```

也可直接打开对应波次文件中的专属提示词整段粘贴：

| 波次 | 路径 |
|------|------|
| A | `docs/superpowers/prompts/wave-a.md` |
| B | `docs/superpowers/prompts/wave-b.md` |
| C | `docs/superpowers/prompts/wave-c.md` |

## 开工检查清单

- [ ] 已读本模块 `*-design.md` 与其 `requires` 上游规格
- [ ] 短名：`manifest.id` ≡ install id ≡ npm 后缀；无 `feature-` / `core-`
- [ ] 依赖仅在 AGENT_BRIEF 白名单内
- [ ] 生命周期顺序正确；事件不在 `init`；表在 `init` + `defineTable`
- [ ] 跨模块仅 `service.call` / `service.provide`
- [ ] 完成后跑自检：`docs/superpowers/prompts/self-check.md`

## 关联

- 作者面工具链（link / watch / publish）→ `sfmc-module-author`
- 架构审查 → `sfmc-code-review` · `docs/superpowers/prompts/self-check.md`
- 索引说明 → `docs/superpowers/prompts/README.md`
