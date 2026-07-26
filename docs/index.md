# SFMC 文档

ScriptsForMinecraftServer 官方文档站（MkDocs Material）。

在线地址：<https://dogelakedev.github.io/ScriptsForMinecraftServer/>

## 按角色入口

| 你是谁 | 从这里开始 |
|--------|------------|
| 服主 / 运维 | [使用指南](./guide/index.md) |
| 写业务模块 | [开发指南 · 模块开发](./dev/module-author.md) |
| 改平台 | [开发指南 · 平台开发](./dev/platform.md) |
| 查 HTTP / 模块服务 | [接口指南](./api/index.md) |
| 查 SDK 类型 | [SDK 类型参考](./reference/index.md)（CI / `npm run docs:api` 生成） |

## 本地预览

```bash
pip install -r docs/requirements.txt
npm install
npm run docs:serve
```

浏览器打开 http://127.0.0.1:8000 。

- `npm run docs:api` — 仅 TypeDoc → `docs/reference/sdk/`
- `npm run docs:build` — TypeDoc + MkDocs → `site/`
