# 模块编译

行为包不是仓库里写死的，而是已启用模块在 **build / 启动闸门** 时现装的。

## 命令

```bash
# 仅构建 BP+RP（不部署）
sfmc mod build

# 构建 + 部署 + 向 BDS 发 reload（开发常用）
sfmc mod reload
sfmc mod reload --build-only   # 只 build+deploy；随后在 BDS/游戏内输入 reload
```

`start bds` / `restart bds` **之前**会自动比对装载 catalog：不一致则先整包重编并部署，成功后才启动 BDS。

第三方世界 BP/RP 的安装与启停请用 `sfmc addon` / `sfmc packs`（见 [资源包管理](./world-packs.md)），不要与模块聚合包混用。

## 路径

| 阶段 | 位置 |
| ------ | ------ |
| esbuild 中间产物 | `packs/_build/sfmc-modules-bp/scripts/main.js` |
| 组装后的 BP | `packs/_build/sfmc-modules/` |
| 组装后的 RP | `packs/_build/sfmc-modules-rp/` |
| 部署目标 BP | `<BDS>/worlds/<level>/behavior_packs/sfmc-modules/` |
| 部署目标 RP | `<BDS>/worlds/<level>/resource_packs/sfmc-modules-rp/` |
| 装载 catalog | 世界 BP 内 `sfmc-deploy-catalog.json` |
| Script API 权限 | `<BDS>/config/<bpUuid>/permission.json`（已存在则跳过） |

## 流程简述

1. 扫描 `modules/packages/*/sapi`，按 `module-lock.json` **仅打包已启用**模块
2. esbuild 打成 `main.js`（`@minecraft/*` 保持 external）
3. pack-manager 组装 BP/RP（**稳定 UUID**，写入 catalog）
4. deploy 复制到世界目录，写入 `world_behavior_packs.json` / `world_resource_packs.json`
5. 若无 `<BDS>/config/<bpUuid>/permission.json` 则生成

一个模块都没 enable 时也会生成合法的空包。装载相关日志走统一日志源 **`pack`**（REPL Ctrl+L 可过滤）。

下一章：[QQ 互通](./qq-bridge.md)
