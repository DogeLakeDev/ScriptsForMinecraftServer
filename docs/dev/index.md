# 开发指南

面向：**模块作者** 与 **SFMC贡献者**。

- [贡献指南](./contributing.md)
- [架构](./architecture.md)
- [模块开发](./module-author.md)
- [manifest 契约](./manifest.md)
- [模块服务目录](../api/modules/index.md)
- [构建管线](./build-pipeline.md)
- [工具脚本](./tools.md)
- [平台开发](./platform.md)
- [npm 发布](./npm-publish.md)
- [代码约定](./conventions.md)

## 本地最小流程（模块作者）

```bash
sfmc module create          # 或 sfmc module link / module dev
# … 开发 …
sfmc mod reload                 # build + deploy + 向 BDS 发 reload
```

接口细节见 [接口指南](../api/index.md)。
