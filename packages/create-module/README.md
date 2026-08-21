# @sfmc-bds/create-module

创建 SFMC SAPI 模块骨架。业界入口：

```bash
npm create @sfmc-bds/module@latest
# 等价：npx @sfmc-bds/create-module@latest
```

程序化 API（VS Code/Cursor 扩展使用同一函数）：

```ts
import { createModule } from "@sfmc-bds/create-module";

await createModule({
  targetDir: "./my-feature",
  id: "my-feature",
  name: "我的功能",
  scope: "alice",
  extras: ["db"],
});
```

模板权威目录：`templates/base/`（+ `templates/extras/*` overlay）。
