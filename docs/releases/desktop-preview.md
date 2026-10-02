SFMC Desktop 首个 Windows x64 预发布版，版本 **0.1.0-preview.1**。安装包尚未签名，签名申请正在审核。

支持本机与 SSH 实例、服务启停、控制台、模块/资源包、配置、玩家、维护任务和运行指标。内置平台 **0.2.9-preview.1**、Node.js 与 pnpm；无需另外安装本机运行环境。本机 Windows 与 SSH Windows 的数据服务/BDS、真实指标、守护进程重连已验收。

### 下载与使用

1. 下载 `.exe` 安装，或完整解压 `.zip` 后运行 `SFMC Desktop.exe`。
2. 添加本机实例，选择 SFMC 部署根目录；SSH 实例填写实际主机、端口、用户、私钥及远程根目录。
3. 现有正式部署先选择“仅查看”。完整预览请在独立测试目录初始化；连接现有部署不会自动替换其活动平台。
4. 在概览启动数据服务和 BDS，通过控制台与任务查看结果。关闭客户端不停止服务器。

[完整使用文档与截图](https://github.com/DogeLakeDev/ScriptsForMinecraftServer/blob/desktop-preview-v0.1.0-preview.1/docs/zh/guide/desktop.md)

### 注意事项

- 未签名软件可能触发 Windows 未知发布者或 SmartScreen 提示。核对仓库地址与 `SHA256SUMS.txt` 后自行决定是否运行，无需关闭安全功能。
- `release-manifest.json` 记录构建提交、内置运行时版本及材料校验值。
- 预览版手动下载更新，不加入稳定版自动更新通道。
- 内置预览平台未作为 npm 正式版发布；旧部署的接口、旧模块兼容性与游戏内交互仍需单独验收。
