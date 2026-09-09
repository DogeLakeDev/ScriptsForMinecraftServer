# {{pkgName}}

SAPI 模块 `{{id}}`。

## 配置

在 `configs-default/{{configKey}}.json` 中列出所有可配置字段及默认值。SFMC 安装或更新模块时会创建工作目录配置或只补充缺失字段，不覆盖服主已有值。不要为播种默认值而在启动时调用 `config.set()`。

## 开发

```bash
pnpm install          # 或 npm install
pnpm run typecheck    # 或 npm run typecheck
pnpm test             # 或 npm test
pnpm run lint         # 或 npm run lint
```

## 联调

1. 扩展 **SFMC: Link to SFMC Root**（或 `sfmc mod install {{id}} --from dir:. --link`）
2. **SFMC: Start Watch** / `sfmc mod reload`

## 脚本

| 命令                               | 作用                           |
| ---------------------------------- | ------------------------------ |
| `pnpm run build` / `npm run build` | tsc --noEmit                   |
| `pnpm test` / `npm test`           | manifest / DESCRIPTOR 静态单测 |
| `pnpm run lint` / `npm run lint`   | ESLint / Prettier              |
