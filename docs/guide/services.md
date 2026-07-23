# 服务管理

> 控制台输入 `start -all` 启动所有服务；输入 `status` 查看服务运行状态。

## 🧺 常用命令

| 命令 | 说明 |
| ------ | ------ |
| `start db\|qq\|llbot\|bds\|-all` | 启动（ `bds` 启动前会校验并按需重编行为包） |
| `stop …` / `restart …` | 停止 / 重启 |
| `logs <svc> [-n N] [-f]` | 推荐使用快捷键 `CTRL + L` |
| `init` | 重新进入向导 |
| `update [--check-only]` | 检查或安装 BDS 更新 |
| `module`/`mod` `list\|install\|build\|…` | （见 [模块](./modules.md)） |
| `pack` `status\|build\|deploy\|list\|…` | （见 [模块打包](./behavior-pack.md)） |
| `packs`/`addon` `list\|scan\|install\|…` | （见 [资源包管理](./world-packs.md)） |
| `remote enroll\|status\|disable` | 远程控制 |

## 🛫 行为包与 BDS 启动

`start bds` / `restart bds` / `start -all` 在拉起 `bedrock_server.exe` **之前**会：

1. 扫描 `<SFMC_ROOT>/packs/` 文件夹，安装世界 BP/RP（空文件夹无输出；见 [资源包管理](./world-packs.md)）
2. 比对模块资源包 内 `sfmc-deploy-catalog.json` 与本机模块启用情况/指纹
3. 不一致则会触发脚本编译，并写入`server-net`权限（若无）
4. 打印装载摘要；失败则**不**启动 BDS

> 手动编译：`mod build`

## ✈️ 一键启动

```text
sfmc> start -all
```

会按 **db → qq → llbot → bds** 顺序拉起；bds 步含装载闸门。

下一章：[模块](./modules.md)
