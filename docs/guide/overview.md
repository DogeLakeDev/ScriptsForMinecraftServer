# 概览

> 理念：行为包脚本当前端，数据与配置走外置 Node 服务后端。

## 核心组件

| 组件 | 作用 |
| ------ | ------ |
| **模块** | 自由装卸与管理，基于原生SAPI编写，最后编译为行为包置于世界中运行 |
| **db-server** | SQLite + REST，配置快照、模块启停、数据库、跨模块服务 |
| **qq-bridge** | 接 LLBot 反向 WS，轻松实现群服互通 |
| **bds-tools** | BDS 下载、安装、更新与进程管理 |

## 端口

| 端口 | 用途 |
| ------ | ------ |
| 3001 | db-server REST |
| 3002 | qq-bridge ← LLBot 反向 WS |
| 3004 | db-server → LLBot（MC→QQ） |

## 系统要求

- Node.js **22.13+**
- BDS **1.26.x**
- Windows 需 Loopback Exemption（向导会提示）

下一章：[安装](./install.md)
