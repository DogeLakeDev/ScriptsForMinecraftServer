---
"@sfmc-bds/cli": minor
---

feat(sfmc): `mod publish` 接 gh CLI 真实开薄 index PR

- `openIndexPr` 从占位升级成可执行：检测 `gh` 鉴权 → `gh repo fork` → clone fork → `git checkout -b publish/<id>-<ver>` → patch `index.json`（upsert 幂等）→ `git commit` → `git push` → `gh pr create`。
- 新 CLI flags：
  - `--gh-repo OWNER/REPO`（默认 `Tanya7z/sfmc-modules`）
  - `--gh-push` 显式 opt-in 真执行（否则只打印意图，避免误污染远端）
  - `--gh-fork-remote <name>`（默认 `sfmc-modules-fork`）
- 安全：默认行为 = 打印 intent + gh 命令清单（dry-run 友好）；真执行需 `--gh-push`；缺鉴权时降级为 dry-run + 提示 `gh auth login`。
- 新函数 `indexEntryFor(pkgName, version, sdkRange)` / `splitOwnerRepo(s)` / `patchIndexFile(path, entry)` —— 单一职责，可单测。
- `patchIndexFile` 校验 `id` 已存在则报错（避免静默覆盖历史版本）。
- 测试：`module-publish.test.mjs` 加 8 cases（splitOwnerRepo / indexEntryFor / patchIndexFile 缺文件 / 追加排序 / 重复 id / openIndexPr dry-run / skip-index-pr / 非法 repo）；sfmc workspace **93/93** 通过。
- npm publish 成功但 PR 失败 → **不回滚 publish**（包已发）；给明确「手动补 index.json」提示。