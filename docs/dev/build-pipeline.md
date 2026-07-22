# 构建管线

行为包在部署时组装，仓库里没有固定的 BP 壳。

## 流程

```
modules/packages/*/sapi/src/index.ts
        │ esbuild（external @minecraft/*）
        ▼
build/sfmc-modules-bp/scripts/main.js
        │ pack-manager assemble-bp
        ▼
build/sfmc-modules/
        │ deploy
        ▼
<BDS>/worlds/<level>/behavior_packs/sfmc-modules/
```

## 相关代码

| 位置 | 作用 |
|------|------|
| `sfmc/src/commands-behavior-pack.ts` | CLI `build` / `deploy` |
| `bds-tools/src/pack-manager.ts` | 组装、复制、启用包 |
| `@sfmc-bds/sdk/behavior-pack-build` | 构建辅助（平台内部） |

## 打包规则

- 只 bundle **lock 里 enabled** 且 catalog 里有的模块
- 每个模块必须 `ModuleRegistry.register`
- 空模块集 → 合法空 `main.js`

## 命令

```bash
node sfmc/dist/main.js behavior-pack build
node sfmc/dist/main.js behavior-pack deploy
```

pack-manager 还提供 `enable-pack` / `disable-pack` 改世界里的包列表，与 deploy 分开。

## 改模块后

1. 改 `packages/<id>/sapi/` 源码
2. `build` + `deploy`
3. 重启 BDS

只改 Node 侧（db-server）不用 redeploy BP；只改 SAPI 必须 redeploy。
