# 命令列表

本页为 SFMC 交互终端命令速查。输入 `help` 可查看当前环境可用命令。

别名：`mod` 即 `module`，`addon` 即 `packs`。流程说明见 [服务管理](./services.md)、[模块](./modules.md)、[附加包](./addons.md)。

## 服务

| 命令                             | 作用                               |
| -------------------------------- | ---------------------------------- |
| `status`                         | 查看运行状态                       |
| `start db\|qq\|llbot\|bds\|-all` | 启动                               |
| `stop …` / `restart …`           | 停止 / 重启                        |
| `logs <svc> [-n N] [-f]`         | 查看日志；快捷键 `Ctrl+L`          |
| `send <svc> <…>`                 | 向服务进程发输入（仅交互终端）     |
| `init`                           | 重新进入初始化向导（需 TTY）       |
| `update [--check-only]`          | 检查或安装 BDS 更新                |

## 模块

| 命令                            | 作用                                   |
| ------------------------------- | -------------------------------------- |
| `mod list` / `mod info <id>`    | 列表 / 详情                            |
| `mod search`                    | 检索                                   |
| `mod install <id>…`             | 安装                                   |
| `mod uninstall <id>…`           | 卸载                                   |
| `mod enable \| disable <id>`    | 启停（写 lock；db 在线时顺带热同步）   |
| `mod verify`                    | 校验                                   |
| `mod build`                     | 仅构建行为包                           |
| `mod reload [--build-only]`     | 构建部署，并可请求 BDS reload          |

顶层短命令 `install` / `uninstall` / `search` / `verify` 等同 `mod …`。

作者向测试、Watch、发布见 [模块开发](../dev/module-author.md)（扩展「SFMC Module」）；不再提供 `mod test`、`mod watch`、`mod publish`。

## 附加包

| 命令                                      | 作用                   |
| ----------------------------------------- | ---------------------- |
| `packs list` / `packs search <q>`         | 列表 / CurseForge 搜索 |
| `packs install` / `packs scan`            | 安装 / 扫收件箱        |
| `packs enable \| disable <id>`            | 启停                   |
| `packs uninstall [id…] [--purge]`         | 卸载                   |
| `packs bind` / `unbind` / `sources`       | 更新源                 |
| `packs check` / `packs update`            | 检查 / 应用更新        |
| `packs bump <id>`                         | RP 抬版                |
| `packs doctor` / `packs path`             | 诊断 / 路径            |

## 通用

| 命令      | 作用           |
| --------- | -------------- |
| `locale`  | 界面语言       |
| `version` | 版本           |
| `help`    | 帮助           |
| `quit`    | 退出交互终端   |
| `debug …` | 调试（开发用） |
