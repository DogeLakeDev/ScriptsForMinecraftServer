SFMC Desktop **0.3.10**，Windows x64 正式构建。

内置平台 **0.2.25**、Node.js 与 pnpm。

### 本次更新

- 侧栏「维护」新增「计分板」，查看世界里的全部计分项和参与者分数：选中计分项后显示参与者数、总分、平均、中位数、最高和最低分，以及排行前 10 和分数分布。可以新建或删除计分项，对参与者设为、增加、减少或重置分数，修改前会显示将要执行的 `/scoreboard` 命令；离线玩家和非玩家实体只能查看。所连平台为 0.2.24 及以上时出现。
- 实例状态顶部状态条以「CPU」取代运行服务数量；运行曲线新增「CPU」，主机与 BDS、数据服务、守护进程等各进程的占用率画在同一条百分比纵轴上（以整机全部核心为 100%），右侧栏显示主机 CPU 与每个进程的占用率。所连平台为 0.2.25 及以上时有数据，旧平台的进程行仍显示累计 CPU 秒数。
- 在告警抽屉或「需要关注」里点开一条告警后，只把这一条标为已读；同一条之后再出现仍算未读。
- 对话框、抽屉和弹出菜单里落在顶栏高度内的按钮可以正常点击，不再被当成拖动窗口。
- 切换到还没有行为日志能力的旧平台时，行为日志页不再弹出「不支持的管理方法」。

### 下载与更新

1. 下载 `SFMC-Desktop-0.3.10-x64.exe` 安装，或完整解压同名 `.zip` 后运行 `SFMC Desktop.exe`。
2. 从托盘退出旧客户端后覆盖安装或替换完整 ZIP；服务器目录与数据保留。关闭客户端不停止服务器。
3. 已有服务器不需要为了安装这个客户端而升级平台；要使用计分板，平台需升级到 0.2.24；要看到 CPU 占用率，平台需升级到 0.2.25。

本发行提供 GitHub 构建证明与 SHA256 校验；Windows 程序未做 Authenticode 签名，通过发行页手动更新。

[完整使用文档](https://sfmc.dogelake.cn/guide/desktop)

### 下载验证

发行页公示各文件 SHA256，`SHA256SUMS.txt` 提供校验清单。在 PowerShell 核对：

```powershell
Get-FileHash -LiteralPath '.\SFMC-Desktop-0.3.10-x64.exe' -Algorithm SHA256
gh attestation verify '.\SFMC-Desktop-0.3.10-x64.exe' --repo DogeLakeDev/ScriptsForMinecraftServer --signer-workflow DogeLakeDev/ScriptsForMinecraftServer/.github/workflows/desktop-release.yml --source-ref 'refs/tags/desktop-v0.3.10' --deny-self-hosted-runners
```

ZIP 替换文件名后使用相同命令。`release-manifest.json` 记录源码提交、产品版本、构建号与内置平台版本。
