# @sfmc-bds/devkit

模块作者工具核心：脚手架、监听重建、部署。供 VS Code/Cursor 扩展与脚本直接 import，**不**经 `sfmc` CLI。

```ts
import { startModuleWatch, rebuildAndDeploy, scaffoldModule } from "@sfmc-bds/devkit";
```

脚手架 CLI：

```bash
npx sfmc-new-module my-mod --name "我的模块"
# 或：node node_modules/@sfmc-bds/devkit/scripts/new-module.mjs …
```
