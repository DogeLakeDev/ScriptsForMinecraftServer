# 模块交付自检与验收提示词

完成后对照 skill [sfmc-code-review](../../../.cursor/skills/sfmc-code-review/SKILL.md)（原则细则见同目录 `principles.md`）做自我架构审查。  
**不要**在本文件重复发明审查标准；以该 skill 为权威。

将下列提示词发给 Agent（可替换模块短名）：

```markdown
请根据 `.cursor/skills/sfmc-code-review/SKILL.md` 规范，对刚刚实现的模块进行自我架构审查：

1. 【DRY 检查】：是否存在自建私有钱包、私有审计表或重复逻辑？
2. 【OCP 检查】：是否所有扩展与挂接都经由注册表或插槽模式？
3. 【DIP 检查】：是否只依赖 SDK 公开接口？是否绝对没有跨模块引用源码？
4. 【迪米特法则】：是否仅通过 manifest 声明的 service 交互？
5. 【平台契约】：
   - 命令是否同时支持半角 `!` 和全角 `！`？
   - 消息是否统一走 `Msg.*`？
   - 数据表是否严格为 `sfmc_<id>_*`？
6. 立即在终端运行：`pnpm run typecheck` 和 `pnpm test`，向我汇报验证结果。
```

## 输出期望

- 审查报告格式遵循 `sfmc-code-review` 的 BLOCKER / MAJOR / MINOR 模板，并标注违背的原则。
- 高置信度、可验证的 BLOCKER/MAJOR 应直接给出最小修复补丁。
- typecheck / test 结果如实汇报；失败则先修再宣称完成。
