# 开发指南

面向：**模块作者** 与 **SFMC 贡献者**。

- [贡献指南](./contributing.md)
- [架构](./architecture.md)
- [模块开发](./module-author.md)（唯一作者路径）
- [官方模块迁仓](./migrate-official-modules.md)
- [manifest 契约](./manifest.md)
- [模块服务目录](../api/modules/index.md)
- [构建管线](./build-pipeline.md)
- [工具脚本](./tools.md)
- [平台开发](./platform.md)
- [npm 发布](./npm-publish.md)
- [代码约定](./conventions.md)

## 本地最小流程（模块作者）

```bash
# Use Tanya7z/sfmc-module-template 或:
sfmc module create
# … 开发 …
# 主仓:
sfmc mod install <id> --from dir:<作者仓> --link
sfmc mod reload
```

`sfmc-modules` 仅为薄 index，不是开发工作区。接口细节见 [接口指南](../api/index.md)。
