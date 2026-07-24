# 模块

> 🧙‍♂️: 恭喜你开始探索 SFMC 最有趣的部分🎉  
> 🧙‍♂️ + 🪄 -> 🍔🍟🍕 + 🐈 -> 🍔🍟 + 🐈 -> 🍔 + 🐈 -> 🐈 -> 🐱  
> 🐱: 模块不是什么和「模组」脱节的东西，相反它就是基于**原生BDS**开发的一套性能更好，管理便捷的功能组！  
> 🧙‍♂️: 几乎和主流插件服的体验一致。

## 🐱 安装与卸载

```bash
sfmc> mod search # 🍔：从仓库拉取最新的模块列表！🐈
sfmc> mod install afk land economy # 🍟:你可以一次装多个模块，随便🐈
sfmc> mod uninstall afk # 🐈 

sfmc> mod list # 🐱：含启用/禁用状态

sfmc> mod enable afk # 🐭：模块安装后默认不会启用，需要启用对应模块哦

sfmc> mod build # 🕳️：仅编译；启动服务器时也会自动校验并按需编译
sfmc> mod reload # 🔄：编译 + 部署 + 向 BDS 发 reload（开发常用）
```

> 安装会同步 `modules/catalog.json`，并按 `enabledByDefault` 写入本地 `modules/module-lock.json`。

```json
// module-lock.json
{
  "version": 1,
  "modules": {
    "feature-afk": { "enabled": true, "updatedAt": 0 }
  }
}
```

开发期推荐使用 `sfmc module link` / `--link`，见 [模块开发](../dev/module-author.md)。  
对外服务清单见 [模块服务目录](../api/modules/README.md)。

## 😽 其它模块源

```bash
node tools/fetch-module.mjs install foo --from github:owner/repo@tag
node tools/fetch-module.mjs install foo --from dir:D:/path/to/pkg --link
node tools/fetch-module.mjs install foo --from local:D:/path/foo.zip
```

## 🐭 校验

```bash
npm run catalog-sync              # 按磁盘 packages 重写 catalog
npm run check-modules             # 校验 manifest
npm run check-minecraft-versions  # @minecraft/* 版本对齐
```

下一章：[模块编译](./behavior-pack.md)
