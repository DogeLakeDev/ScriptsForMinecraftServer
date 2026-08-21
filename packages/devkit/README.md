# @sfmc-bds/devkit

模块作者工具核心：Watch、重建部署、启停。供 VS Code/Cursor 扩展与脚本直接 import，**不**经 `sfmc` CLI。

建仓请用：

```bash
npm create @sfmc-bds/module@latest
```

```ts
import { startModuleWatch, rebuildAndDeploy, setModuleEnabled } from "@sfmc-bds/devkit";
```
