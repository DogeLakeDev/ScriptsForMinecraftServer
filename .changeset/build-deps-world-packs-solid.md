---
"@sfmc-bds/tools": patch
"@sfmc-bds/bds-tools": patch
---

发版：build-publishable 拓扑 + listPublishableBuildDeps（npm-publish 应急补发不再硬编码只 build SDK）；push 缺失态 DRY 对齐 listUnpushedExistingVersionTags。世界包：readPackDirOccupancy DRY，去掉死不变式，occupancy 保留真实 kind（LSP）。
