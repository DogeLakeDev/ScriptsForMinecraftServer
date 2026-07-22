# 模块

模块是独立包，从 [sfmc-modules](https://github.com/Tanya7z/sfmc-modules) 拉下来，落到 `modules/packages/<文件夹>/`。

## 两种 id

| 场景 | 用什么 |
|------|--------|
| `fetch-module install`、文件夹名 | 短 id：`afk`、`land`、`economy` |
| manifest、catalog、启停 API | 逻辑 id：`feature-afk`、`feature-land` |

装完看 `modules/packages/afk/sapi/manifest.json` 里的 `id` 字段。

## 安装与卸载

```bash
node tools/fetch-module.mjs search
node tools/fetch-module.mjs install afk land economy
node tools/fetch-module.mjs uninstall afk

# 或
node sfmc/dist/main.js mod search          # 拉取 first-party registry 列表
node sfmc/dist/main.js mod search afk      # 查单模块 registry info
node sfmc/dist/main.js mod install afk
node sfmc/dist/main.js mod list            # 本机已安装
node sfmc/dist/main.js mod info afk        # 本机已安装详情
```

安装会同步 `modules/catalog.json` 和 `modules/module-lock.json`。

## 启用与禁用

```bash
node sfmc/dist/main.js mod enable feature-afk
node sfmc/dist/main.js mod disable feature-afk
```

也可以直接改 `modules/module-lock.json`，然后**重启 BDS**。

```json
{
  "version": 1,
  "modules": {
    "feature-afk": { "enabled": true, "updatedAt": 0 }
  }
}
```

查询状态：

```bash
curl http://127.0.0.1:3001/api/sfmc/modules
```

## 装完还要做什么

1. `module enable`（若默认未启用）
2. `behavior-pack build` + `deploy`（见下章）
3. 重启 BDS

没有热重载，跳过任一步游戏内可能看不到效果。

## 其它来源

```bash
node tools/fetch-module.mjs install foo --from github:owner/repo@tag
node tools/fetch-module.mjs install foo --from dir:D:/path/to/pkg
node tools/fetch-module.mjs install foo --from local:D:/path/foo.zip
```

## 校验

```bash
npm run catalog-sync    # 按磁盘 packages 重写 catalog
npm run check-modules   # 校验 manifest
```

下一章：[行为包](./behavior-pack.md)
