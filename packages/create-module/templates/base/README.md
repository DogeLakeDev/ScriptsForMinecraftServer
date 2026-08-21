# {{id}}

{{name}}（`{{pkgName}}`）— SFMC SAPI 模块。

## 最短成功路径

```bash
npm install
npm run typecheck
npm test
npm run lint
```

用 VS Code / Cursor **单独打开本仓根**。推荐扩展：ESLint、Prettier、SFMC Module、Node.js Test Runner。

1. `npm test`（假引擎；不依赖 `sfmc.root`）
2. 真机联调：设 `sfmc.root` 为 SFMC **工作目录**（含 `configs/`、`modules/`），再扩展 Start Watch / Reload to BDS
3. link：扩展「SFMC: Link to SFMC Root」，或  
   `sfmc mod install {{id}} --from dir:<本仓绝对路径> --link`
4. 发布：`npm publish --access public`，并向 `sfmc-modules` 的 `index.json` 开 PR

| 命令 | 作用 |
| --- | --- |
| `npm run build` / `typecheck` | tsc --noEmit |
| `npm test` | createSandbox + DESCRIPTOR |
| `npm run lint` / `format` | ESLint / Prettier |

`DESCRIPTOR.id` 须与 `sapi/manifest.json` 的 `id`（`{{featureId}}`）一致。
