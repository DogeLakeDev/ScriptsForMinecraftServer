---
"@sfmc-bds/bds-tools": minor
"@sfmc-bds/cli": minor
---

feat(bds-tools,cli): 增强 packs doctor 存档实验性玩法开关诊断与自愈配置

- `@sfmc-bds/bds-tools`: 支持检测与修改当前版本已知的全部实验性功能（测试版 API、创作者功能、创作者相机、Voxel形状、村民贸易再平衡、2026年第3次更新、Minecraft Education 功能），提供智能别名解析与安全的原子化 level.dat 修改与灾备。
- `@sfmc-bds/cli`: `packs doctor` 命令支持 `--experiments`、`--all-experiments`、`--experiments=<list>` 开关；在诊断视图中高亮直观展示当前存档的各实验性玩法启用状态。
