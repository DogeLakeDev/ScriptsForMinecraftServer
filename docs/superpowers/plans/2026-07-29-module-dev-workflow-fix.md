# 模块生态纯 index — 实现计划

> 对照 `docs/superpowers/specs/2026-07-29-module-dev-workflow-design.md`。

**目标：** 冻结纯 index + 一模块一仓契约；修好黄金路径；拆除 monorepo DX；索引仓瘦身。

---

## Wave 0 — 规格

- [x] 规格改为纯 index / 无 Path B
- [x] 本计划与 Cursor plan 对齐

## Wave 1 — 主仓 CLI

- [x] `tools/lib/link-from.mjs` + 测试；`fetch-module` 接入
- [x] `registry-index` / `registry.ts` 支持 npm；`defaultSourceFor` 优先 npm
- [x] `patchIndexFile` map；precheck private / `@sfmc-bds`
- [x] 拆除 Path B（wizard / 自动 link / i18n）
- [x] `new-module` 仅单包根；社区包名；`--root` 移除
- [x] 文档单轨

## Wave 2 — 模板仓

- [x] 去 private；rename --scope/--official；README；release.yml map

## Wave 3 — sfmc-modules

- [x] 归档 branch/tag；main 仅 index + README；version 2

## Wave 4 — 迁仓（分批）

- [x] `docs/dev/migrate-official-modules.md` + `tools/export-module-from-archive.mjs`（已验证导出 economy）
- [ ] 各官方模块独立仓 + npm 发布（按需分批，不阻塞本轮）
