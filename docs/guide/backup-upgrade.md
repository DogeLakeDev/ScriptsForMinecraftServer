# 备份与升级

## 备份什么

建议一起打包：

- `data/`（SQLite）
- `configs/`
- `modules/catalog.json`、`modules/module-lock.json`

## 备份步骤

先停 db-server，避免 WAL 下文件不一致：

```text
sfmc> stop db
```

打包后再 `start db`。

不要在 db-server 运行时直接复制 `.db` 文件。

## 升级主仓

```bash
git pull
npm install
npm run build --workspaces --if-present
node sfmc/dist/main.js behavior-pack build
node sfmc/dist/main.js behavior-pack deploy
# 重启服务与 BDS
```

## 升级模块

```bash
node tools/fetch-module.mjs install <id>
# 再 build + deploy + 重启 BDS
```

## 升级 BDS 本体

```bash
node sfmc/dist/main.js update
# 或
node bds-tools/dist/check-update.js --check-only
node bds-tools/dist/check-update.js --force
```

db-server 启动时会跑 `initSchema` 做增量迁移，老数据库一般能直接沿用。

## 回滚

- 配置 / lock：用备份覆盖
- BP：重新 `build` + `deploy` 上一版模块
- BDS：用 bds-tools 的 rollback（若你启用了备份策略）
  - 运行态在 `<SFMC_ROOT>/.sfmc/`（回滚标记 / PID / version cache）
  - 落盘日志统一在 `<SFMC_ROOT>/.sfmc/logs/`：
    - `db.log` / `qq.log` — 各服务进程自写
    - `bds-update.log` — BDS 更新器
    - `bds.log` / `llbot.log` — sfmc 捕获的外部进程输出
    - `sfmc.log` — 监督器 / pack / system 等
