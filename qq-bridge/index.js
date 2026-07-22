#!/usr/bin/env node
/**
 * index.js — 入口 shim
 *
 * QQ ↔ MC 桥接进程入口。源码在 src/，tsc 编译产物在 dist/。
 * 之所以保留这个 shim 是因为:
 *   1. panel/src/services/manager.ts 通过 `node qq-bridge/index.js` 启动
 *   2. modules/catalog.json 中 entry.path 指向 "qq-bridge/index.js"
 *   3. tools/check-ootb.mjs 自检要求该文件存在
 *
 * 启动方式:
 *   - `npm start`           -> `node dist/index.js` (直接走编译产物)
 *   - `node index.js`       -> 经本 shim 委托到 dist/index.js
 *   - `npm run dev`         -> `tsx src/index.ts`   (开发态,不走 dist)
 *   - `npm run build`       -> `tsc -p tsconfig.json` 生成 dist/
 */

import("./dist/index.js").catch((e) => {
  const msg = e instanceof Error ? e.message : String(e);
  if (/MODULE_NOT_FOUND|Cannot find module/.test(msg)) {
    console.error("[QQBridge] dist/ 未找到，请先运行 `npm run build`");
    process.exit(2);
  }
  console.error("[QQBridge] 启动失败:", msg);
  process.exit(1);
});
