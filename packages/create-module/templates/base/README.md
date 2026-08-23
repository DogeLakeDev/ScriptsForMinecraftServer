# {{pkgName}}

SAPI 模块 `{{id}}`。

## 开发

```bash
pnpm install          # 或 npm install
pnpm run typecheck    # 或 npm run typecheck
pnpm test             # 或 npm test
pnpm run lint         # 或 npm run lint
```

## 联调

1. `pnpm test` / `npm test`（假引擎；不依赖 `sfmc.root`）
2. 扩展 **SFMC: Link to SFMC Root**（或 `sfmc mod install {{id}} --from dir:. --link`）
3. **SFMC: Start Watch** / `sfmc mod reload`

## 脚本

| 命令 | 作用 |
| ------ | ------ |
| `pnpm run build` / `npm run build` | tsc --noEmit |
| `pnpm test` / `npm test` | createSandbox + DESCRIPTOR |
| `pnpm run lint` / `npm run lint` | ESLint / Prettier |
