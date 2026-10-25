SFMC Desktop **0.3.9**，Windows x64 正式构建。

内置平台 **0.2.23**、Node.js 与 pnpm。

### 本次更新

- 侧栏「维护」新增「行为日志」，查看行为日志模块（activity-log）记录的玩家加入、聊天、方块、实体、物品、容器和爆炸事件。可按时间、分类、事件类型、级别和关键词筛选，点开记录查看坐标和附加数据，筛选结果可导出 CSV；顶部统计显示记录数、活跃玩家和事件分布。所连平台为 0.2.23 及以上时出现。
- 玩家页的绑定记录和在线玩家可以直接跳到该玩家的行为日志。
- 实例弹窗可以用小程序扫码或输入登录码，登录管理网关。
- 配置页「BDS配置」表单覆盖平台收录的全部 server.properties 属性，按分组显示中文名称、说明、可选值与取值范围。
- 鼠标不在侧栏时隐藏侧栏滚动条。

### 下载与更新

1. 下载 `SFMC-Desktop-0.3.9-x64.exe` 安装，或完整解压同名 `.zip` 后运行 `SFMC Desktop.exe`。
2. 从托盘退出旧客户端后覆盖安装或替换完整 ZIP；服务器目录与数据保留。关闭客户端不停止服务器。
3. 已有服务器不需要为了安装这个客户端而升级平台；要使用行为日志，平台需升级到 0.2.23 并安装行为日志模块。

本发行提供 GitHub 构建证明与 SHA256 校验；Windows 程序未做 Authenticode 签名，通过发行页手动更新。

[完整使用文档](https://sfmc.dogelake.cn/guide/desktop)

### 下载验证

发行页公示各文件 SHA256，`SHA256SUMS.txt` 提供校验清单。在 PowerShell 核对：

```powershell
Get-FileHash -LiteralPath '.\SFMC-Desktop-0.3.9-x64.exe' -Algorithm SHA256
gh attestation verify '.\SFMC-Desktop-0.3.9-x64.exe' --repo DogeLakeDev/ScriptsForMinecraftServer --signer-workflow DogeLakeDev/ScriptsForMinecraftServer/.github/workflows/desktop-release.yml --source-ref 'refs/tags/desktop-v0.3.9' --deny-self-hosted-runners
```

ZIP 替换文件名后使用相同命令。`release-manifest.json` 记录源码提交、产品版本、构建号与内置平台版本。
