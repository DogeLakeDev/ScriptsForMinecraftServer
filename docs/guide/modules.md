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
node sfmc/dist/main.js mod build           # 按启用状态整包编译 BP+RP
```

安装会同步 `modules/catalog.json` 和 `modules/module-lock.json`。

## 启用与禁用

```bash
node sfmc/dist/main.js mod enable feature-afk
node sfmc/dist/main.js mod disable feature-afk
```

也可以直接改 `modules/module-lock.json`，然后 `sfmc reload`（或 `pack build` + `pack deploy` + BDS/游戏内 `reload`）。

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

1. `mod enable`（若默认未启用）
2. `sfmc reload`（build + deploy + 向 BDS 发 `reload`）  
   - 或 `mod build` / `pack deploy` 后在 BDS/游戏内手动 `reload`  
   - 冷启动：`start bds` 前会自动比对 catalog 并按需重编
3. 改 **configs/*.json** 仍需重启对应进程（配置启动缓存）

开发期推荐 `sfmc module link` / `--link`，见 [模块开发](../dev/module-author.md)。  
对外服务清单见 [模块服务目录](../api/modules/README.md)。

## 其它来源

```bash
node tools/fetch-module.mjs install foo --from github:owner/repo@tag
node tools/fetch-module.mjs install foo --from dir:D:/path/to/pkg --link
node tools/fetch-module.mjs install foo --from local:D:/path/foo.zip
```

## 校验

```bash
npm run catalog-sync              # 按磁盘 packages 重写 catalog
npm run check-modules             # 校验 manifest
npm run check-minecraft-versions  # @minecraft/* 版本对齐
```

下一章：[行为包](./behavior-pack.md)
