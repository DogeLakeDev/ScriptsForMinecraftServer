# SDK 类型参考

本目录存放 **TypeDoc + typedoc-plugin-markdown** 从 `@sfmc-bds/sdk` 源码生成的 API 文档。

## 生成

```bash
npm run docs:api
```

输出路径：`docs/reference/sdk/`（已 gitignore，需本地或 CI 生成）。

## 浏览

```bash
pip install -r docs/requirements.txt
npm run docs:serve
```

浏览器打开 http://127.0.0.1:8000 ，侧栏「SDK 类型参考」。

手写导读（runtime / db / config / service 用法）仍在 [接口指南 · SDK](../api/sdk/index.md)。
