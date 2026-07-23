# 行为包

行为包不是仓库里写死的，而是你装的模块 **build 时现装** 的。

## 命令

```bash
# 手动整包编译(仅启用模块)
node sfmc/dist/main.js mod build
node sfmc/dist/main.js pack build
node sfmc/dist/main.js behavior-pack build   # 别名 bp build

# 部署到世界 + 写 world_*_packs.json + config/<uuid>/permission.json
node sfmc/dist/main.js pack deploy
node sfmc/dist/main.js bp deploy

# 状态 / 世界清单
node sfmc/dist/main.js pack status
node sfmc/dist/main.js pack list
node sfmc/dist/main.js pack enable|disable [behavior|resource]
```

`start bds` / `restart bds` **之前**会自动比对装载 catalog：不一致则先整包重编并部署，成功后才启动 BDS。

**日常改模块代码**请用：

```bash
sfmc reload              # build + deploy + 向 BDS 发 reload
sfmc reload --build-only # 只部署；随后在 BDS/游戏内输入 reload
```

不必为脚本更新去重启整个 BDS 进程（除非你在改配置或需要冷启动）。

## 路径

| 阶段 | 位置 |
|------|------|
| esbuild 中间产物 | `build/sfmc-modules-bp/scripts/main.js` |
| 组装后的 BP | `build/sfmc-modules/` |
| 组装后的 RP | `build/sfmc-modules-rp/` |
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

一个模块都没 enable 时也会生成合法的空包（几乎空的 `main.js`）。

## 资源包

模块若带 `resource_pack/` 且已启用，会并入 `sfmc-modules-rp`。装载相关日志走统一日志源 **`pack`**（REPL Ctrl+L 可过滤）。

下一章：[QQ 互通](./qq-bridge.md)
