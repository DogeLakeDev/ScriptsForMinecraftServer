# 概览

SFMC 把 BDS 的 Script API 扩成一套能长期运维的服务端：游戏内跑 SAPI，数据与配置走外置 Node 服务。

## 核心组件

| 组件 | 作用 |
|------|------|
| **BDS + 行为包** | 游戏内逻辑，由已装模块实时装配 |
| **db-server** | SQLite + REST，配置快照、模块启停、数据库、跨模块服务 |
| **qq-bridge** | 接 LLBot 反向 WS，把群消息送进 db-server |
| **sfmc CLI** | 向导、启停服务、装模块、构建部署 BP |
| **bds-tools** | BDS 更新与进程管理 |

业务模块不在主仓里硬编码，从 [sfmc-modules](https://github.com/Tanya7z/sfmc-modules) 按需安装到 `modules/packages/`。

## 数据怎么流

```
注册表 → fetch → packages/ → build → BDS 行为包
BDS(SAPI) ←HTTP :3001→ db-server
LLBot ←WS/HTTP→ qq-bridge / db-server
```

**为什么用外置数据库？**  
SAPI 只发请求，读写 SQLite 在 Node 里完成。经济、领地这类操作可以走事务和幂等，比纯游戏内处理更稳，也更好备份。

## 端口

| 端口 | 用途 |
|------|------|
| 3001 | db-server REST |
| 3002 | qq-bridge ← LLBot 反向 WS |
| 3004 | db-server → LLBot（MC→QQ） |

## 系统要求

- Node.js **22.13+**（db-server 用原生 `node:sqlite`）
- BDS **1.26.x**
- Windows 需 Loopback Exemption（向导会提示）

下一章：[安装](./install.md)
