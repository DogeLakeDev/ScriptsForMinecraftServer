# 文档站维护说明

## 栈

| 组件 | 用途 |
|------|------|
| **MkDocs Material** | 静态文档站（`mkdocs.yml`） |
| **awesome-pages** | 用各目录 `.pages` 控制导航顺序 |
| **TypeDoc + typedoc-plugin-markdown** | 从 `@sfmc-bds/sdk` 源码生成 Markdown API |

## 目录约定

```
docs/
├── guide/          # 手写 · 使用指南
├── dev/            # 手写 · 开发指南
├── api/            # 手写 · HTTP / 模块服务 / SDK 导读
└── reference/
    ├── index.md    # 类型参考说明
    └── sdk/        # TypeDoc 输出（gitignore，本地生成）
```

| 路径 | 作用 |
| ------ | ------ |
| mkdocs.yml | Material 主题、插件、校验 |
| typedoc.json | @sfmc-bds/sdk 全量 entryPoints → Markdown |
| docs/guide | dev |
| docs/reference/sdk/ | TypeDoc 生成（gitignore，需 docs:api）|
| docs/**/.pages | awesome-pages 导航顺序 |

首页与各章入口文件名为 **`index.md`**（MkDocs 惯例，勿用 `README.md`）。

## 常用命令

```bash
pip install -r docs/requirements.txt
npm install

npm run docs:api      # 仅 TypeDoc → docs/reference/sdk/
npm run docs:serve    # TypeDoc + mkdocs serve
npm run docs:build    # TypeDoc + mkdocs build → site/
```

## 配置入口

- `mkdocs.yml` — 站点主题、插件、顶层 nav
- `typedoc.json` — entryPoints、Markdown 输出选项
- `modules/sdk/@sfmc-sdk/tsconfig.typedoc.json` — TypeDoc 用 tsconfig
- `docs/**/.pages` — 各节导航顺序

## 新增手写页面

1. 在对应目录加 `.md`
2. 写入该目录 `.pages` 的 `nav` 列表
3. 从章节 `index.md` 加链接

### 链接约定（契约）

- **站内页**：用相对 `docs/` 的路径（`./guide/`、`../dev/`），**不要**写成仓根的 `./docs/...`。
- **仓外目标**（源码、workflow、LICENSE、`configs/` 等）：用 GitHub 绝对 URL（`https://github.com/DogeLakeDev/ScriptsForMinecraftServer/blob/main/...`）。相对 `../../sfmc/...` 在 Pages 上会 404。
- `npm run docs:build` / `docs:serve` 会解析手写 `.md` 相对链接；逃出 `docs/` 即失败。

## 扩展 TypeDoc 入口

在根目录 `typedoc.json` 的 `entryPoints` 追加 SDK 公开入口（与 `package.json#exports` 对齐）。
