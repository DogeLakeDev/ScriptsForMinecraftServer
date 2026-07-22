# 排障

## 自检工具

```bash
npm run check-ootb       # 整体开箱检查
npm run check-modules    # catalog + manifest
npm run catalog-sync     # packages → catalog
```

## db-server 起不来

| 现象 | 处理 |
|------|------|
| 秒退、`node:sqlite` 报错 | Node 升到 **22.13+** |
| 端口占用 | 改 `db_port` 或 `DB_PORT` |
| 模块 API 空 | 检查 `modulesDir` 是否为 `"modules"` |
| SQLite 损坏 | 停服后从备份恢复 |

```bash
curl http://127.0.0.1:3001/api/health
```

## BDS 脚本报错

1. 看 BDS 日志第一条错误
2. `npm run check-modules`
3. `behavior-pack build` 看 esbuild 输出
4. 确认模块已 enable，且 deploy + 重启 BDS

## 模块已 enable 但游戏里没效果

- 是否 build + deploy 过？
- lock 里 `enabled: true` 吗？
- `GET /api/sfmc/modules/<id>` 确认状态
- 临时 disable 该模块，排除单模块问题

## QQ 桥

1. LLBot reverse-ws 是否为 `ws://127.0.0.1:3002`
2. `qq_group_id`、`llbot_*` 是否正确
3. qq-bridge 日志里有没有连上 LLBot
4. 防火墙是否拦 3002

## import / build 失败

monorepo 下先：

```bash
npm run build --workspaces --if-present
```

## 旧文档里的坑

以下已废弃，别再搜：

- `check-ootb.js`、`check-catalog.js` → 用 `.mjs`
- `emit-manifest`、`modules/_manifests/` → db-server 直接读各包 manifest
- `panel/` → 用 `sfmc`

仍解决不了，到 GitHub Issues 带上 BDS 日志、`check-ootb` 输出和 Node 版本。
