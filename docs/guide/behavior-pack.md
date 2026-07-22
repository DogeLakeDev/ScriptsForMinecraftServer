# 行为包

行为包不是仓库里写死的，而是你装的模块 **build 时现装** 的。

## 命令

```bash
node sfmc/dist/main.js behavior-pack build
node sfmc/dist/main.js behavior-pack deploy
# 别名: bp build / bp deploy
```

改模块源码或启停后，都要重新 build + deploy，再重启 BDS。

## 路径

| 阶段 | 位置 |
|------|------|
| esbuild 中间产物 | `build/sfmc-modules-bp/scripts/main.js` |
| 组装后的 BP | `build/sfmc-modules/` |
| 部署目标 | `<BDS>/worlds/<level>/behavior_packs/sfmc-modules/` |

## 流程简述

1. 扫描 `modules/packages/*/sapi/src/index.ts`
2. esbuild 打成 `main.js`（`@minecraft/*` 保持 external）
3. pack-manager 组装 manifest、权限等
4. deploy 复制到 BDS 世界目录

一个模块都没 enable 时也会生成合法的空包（几乎空的 `main.js`）。

## 资源包

模块若带 `resource_pack/`，会一并处理；RP 名一般为 `sfmc-modules-rp`。

下一章：[QQ 互通](./qq-bridge.md)
