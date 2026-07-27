---
"@sfmc-bds/tools": patch
"@sfmc-bds/bds-tools": patch
---

发版：build-publishable 拓扑 + listPublishableBuildDeps（npm-publish 应急补发不再硬编码只 build SDK）；push 缺失态 DRY 对齐 listUnpushedExistingVersionTags。世界包：readPackDirOccupancy DRY，去掉死不变式，occupancy 保留真实 kind（LSP）。修 #80/#81 合并冲突：scanDestOccupancy 须赋值 facts=readPackDirOccupancy，禁止残留未声明 uuid/version/name 赋值（否则 --dts 挂掉且 catch 吞掉 ReferenceError 导致占用 uuid 恒空）。
