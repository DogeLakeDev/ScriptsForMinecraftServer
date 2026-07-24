# 首次运行

## 🪁 向导

### S1: 工作环境目录（自动判断）

![S1](image.png)

### S2: 选择外部运行时

![S2](image-1.png)

  - BDS：选择 BDSever 的运行文件夹，可选择已经安装的目录；如未检测到可运行的BDS二进制文件则会在之后提示下载。
  - LLBOT: 需要前往[LLBOT](https://www.llonebot.com/)下载，也可选择已安装的目录（CLI）可不选。
  - DataBase: 数据库储存目录。

### S3: BDS环境检查

![S3](image-2.png)

  - 选择备份目录文件与目录：建议全选

> 输入`help`查看帮助。

## 🗂️ 目录管理

> 正确启动且配置的运行环境应如下图所示。

```folder tree
{工作目录}/
├── {BDS运行目录}/
├── {BDS备份目录}/
├── configs/ # 配置文件目录
├── data/ # 数据库存放目录
├── packs/ # 资源包收件箱、模块编译文件存放目录
└── modules/ # 模块存放目录
```

## 🛠️ 配置文件

首次启动时，各服务根据初始化选择的值将配置写入 `configs/`，其它选项则手动编辑（含 `$schema`，使用如VSCode的IDE 可悬停查看字段说明）。

| 文件 | 用途 |
| ------ | ------ |
| `db_config.json` | db-server 端口、数据路径、模块目录 |
| `qq_config.json` | QQ 桥、LLBot 连接 |
| `bds_updater.json` | BDS 更新与备份 |
| `permissions.json` | 权限表（数组） |
| `pack-update.json` | 世界包自动更新 |
| `remote.json` | 远程管理代理 |

模块配置对应 `configs/<configKey>.json`，缺省由模块/服务首次写入。

下一章：[服务管理](./services.md)
