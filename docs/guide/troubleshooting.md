# 排障

## 自检（monorepo）

```bash
npm run check-ootb
npm run check-modules
npm run catalog-sync
```

## db-server 起不来

| 现象                     | 处理                              |
| ------------------------ | --------------------------------- |
| 秒退、`node:sqlite` 报错 | Node 升到 **22.13+**              |
| 端口占用                 | 改 `db_port` 或环境变量 `DB_PORT` |
| 模块 API 异常            | 确认 `modulesDir` 与 `SFMC_ROOT`  |
| SQLite 损坏              | 停服后从备份恢复                  |

```bash
curl http://127.0.0.1:3001/api/health
```

## 装载闸门 / BDS 未启动

1. 看控制台装载摘要与 `<SFMC_ROOT>/.sfmc/logs/`
2. `mod build` 看 esbuild 是否报错
3. `npm run check-modules`（monorepo）
4. 收件箱冲突是否挡住启动前扫描（见 [附加包](./addons.md)）

## 模块已 enable 但游戏里没效果

- 是否执行过 `mod reload`，或重启过 BDS？
- `modules/module-lock.json` 里是否为 `enabled: true`
- `GET /api/sfmc/modules/<id>` 确认状态
- 临时 `mod disable` 该模块，排除单模块问题
- 依赖模块是否已安装并启用

## 测试沙箱

```bash
npm test
# 须带：
# --import @sfmc-bds/sdk/testing/minecraft-loader
```

| 现象 | 处理 |
| ------ | ------ |
| `UnimplementedMinecraftApiError` /「未实现的 Minecraft API」 | 用例碰到尚未接线的 API：缩小断言面，或等沙箱加深；勿当业务逻辑错误 |
| 断言失败但 BDS 正常 | 可能是沙箱保真差；用扩展 Watch / 真机复核 |
| Testing 面板发现不了用例 | 装 `nodejs-testing`；核对模板 `.vscode/settings.json` 与 `npm test` 脚本 |

作者流程见 [测试沙箱](../dev/testing.md)。

## QQ 桥

1. LLBot 反向 WS 是否为 `ws://127.0.0.1:3002`
2. `qq_group_id`、`llbot_*` 是否正确
3. qq / llbot 日志是否连上
4. 防火墙是否拦截 3002

## 构建与 import

```bash
npm run build --workspaces --if-present
sfmc> mod build
```

旧模块若仍 `import "@sfmc/sdk"`，请用当前 CLI 重装模块，或确认 SDK 可被构建解析。

## 远程控制

- `remote status` 看 `enabled` / `connected` / `last_error`
- 缺字段时先 `remote enroll`
- 控制器 URL、token 是否过期

仍解决不了时，可前往 GitHub Issues 附上 BDS / sfmc 日志、`check-ootb` 输出和 Node 版本。
