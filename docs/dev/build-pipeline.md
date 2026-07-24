# 构建管线

行为包在部署时组装，仓库里没有固定的 BP 壳。

## 流程

```
modules/packages/*/sapi/src/index.ts
        │ esbuild（external @minecraft/*）
        ▼
packs/_build/sfmc-modules-bp/scripts/main.js
        │ pack-manager assemble-bp
        ▼
packs/_build/sfmc-modules/
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

# 开发迭代推荐（build + deploy + 向 BDS 发 reload）
node sfmc/dist/main.js reload
```

pack-manager 还提供 `enable-pack` / `disable-pack` 改世界里的包列表，与 deploy 分开。

## 改模块后

1. 改 `packages/<id>/sapi/` 源码（开发期用 `--link` 链到 sfmc-modules）
2. `sfmc mod reload`（或 `mod build` 后启动服务器触发装载闸门，再在 BDS/游戏内输入 `reload`）
3. **不必**为脚本热更去 `restart bds`；进程级重启仅在改配置、崩服恢复等场景需要

只改 Node 侧（db-server）不用 redeploy BP；只改 SAPI 必须 redeploy + `reload`。