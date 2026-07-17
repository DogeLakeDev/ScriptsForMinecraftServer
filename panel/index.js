#!/usr/bin/env node
/**
 * index.js — 入口 wrapper
 *
 *   用 tsx 的 --import loader 解析 .ts。Node 22+ 推荐这种用法。
 *   注意：直接 `node index.js` 不会启用 loader；
 *   推荐 `npm start`（已经配置为 tsx src/main.ts），
 *   或 `node --import tsx/esm index.js`。
 */

import("./src/main.ts").catch((e) => {
  console.error("[panel] 入口加载失败:", e);
  process.exit(1);
});
