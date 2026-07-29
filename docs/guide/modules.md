# 模块

> 基于**原生 BDS** 的功能组。制品在 **npm**（`@sfmc-bds/module-<id>` 或 `@<author>/sfmc-module-<id>`）。  
> [`sfmc-modules`](https://github.com/Tanya7z/sfmc-modules) 仅为**薄 index**（发现层），不含业务源码。

## 安装与卸载

```bash
sfmc> mod search
sfmc> mod install afk economy
sfmc> mod uninstall afk
sfmc> mod list
sfmc> mod enable afk
sfmc> mod build
sfmc> mod reload
sfmc> mod watch
sfmc> mod test
sfmc> mod publish
```

作者起步：GitHub `Use this template` → `Tanya7z/sfmc-module-template`；联调：

```bash
sfmc mod install <id> --from dir:<作者仓绝对路径> --link
```

详见 [模块开发](../dev/module-author.md)。官方服务清单：[模块服务目录](../api/modules/index.md)。

## 制品来源

| 来源 | 用途 |
|------|------|
| `npm:@scope/name` | **默认**（index 的 `npm` 字段优先） |
| `local:` / `dir:` | 本地目录 / `.tgz` / `.zip`；联调用 `--link` |
| `github:…` | deprecated：旧 index `{repo,tag}` |

## 校验

```bash
npm run catalog-sync
npm run check-modules
node tools/check-minecraft-versions.mjs
```

下一章：[模块编译](./behavior-pack.md)
