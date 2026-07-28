# 模块

> 基于**原生BDS**开发的一套性能更好，管理便捷的功能组

## 安装与卸载

```bash
sfmc> mod search         # 从 npm / first-party registry 拉取最新
sfmc> mod install afk land economy   # 默认走 npm（隔离装到 modules/packages/<id>）
sfmc> mod uninstall afk

sfmc> mod list

sfmc> mod enable afk     # 模块安装后默认不会启用，需要启用对应模块哦

sfmc> mod build          # 仅编译；启动服务器时也会自动校验并按需编译
sfmc> mod reload         # 编译 + 部署 + 向 BDS 发 reload（开发常用）
sfmc> mod watch          # 迭代期：改源码即 rebuild + reload
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
对外服务清单见 [模块服务目录](../api/modules/index.md)。

## 制品格式与来源

| 来源 | 用途 | 示例 |
|------|------|------|
| `npm:@scope/name` | **默认**（install 无 `--from` 时按 id 解析为 `@sfmc-bds/module-<id>`） | `sfmc mod install land` → `npm install @sfmc-bds/module-land` |
| `local:` | 本地目录 / `.tgz` / `.zip`（无路径默认 cwd） | `sfmc mod install --from local` 或 `--from local:./x.tgz` |
| `tgz:` | 同 `local:`，显式声明 `.tgz` | `--from tgz:./foo-1.0.0.tgz` |
| `zip:` | 同 `local:`，强制校验内含 `package.json` + `sapi/manifest.json` | `--from zip:./foo.zip` |
| `dir:` | 本地目录（自动判单包/多包父目录） | `--from dir:D:/path/to/pkg --link` |
| `github:owner/repo[@tag]` | GitHub Release（兼容旧 first-party `Tanya7z/sfmc-modules`） | `--from github:owner/repo@v1.0` |

**默认 source 解析顺序（缺省 --from 时）**：
1. 先看 first-party registry（`Tanya7z/sfmc-modules`）→ 命中走 `github:`
2. 否则按 `@sfmc-bds/module-<folder>` 走 `npm:`

## 其它命令

```bash
# 仅本地源
node tools/fetch-module.mjs install foo --from github:owner/repo@tag
node tools/fetch-module.mjs install foo --from dir:D:/path/to/pkg --link
node tools/fetch-module.mjs install foo --from npm:@author/sfmc-module-foo

# 隔离装到 modules/packages/<id>（不污染主仓根 node_modules）
node tools/fetch-module.mjs install foo --from npm:@author/sfmc-module-foo
```

## 校验

```bash
npm run catalog-sync              # 按磁盘 packages 重写 catalog
npm run check-modules             # 校验 manifest
node tools/check-minecraft-versions.mjs  # @minecraft/* 版本对齐
```

下一章：[模块编译](./behavior-pack.md)
