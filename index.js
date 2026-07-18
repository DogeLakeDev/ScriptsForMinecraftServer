#!/usr/bin/env node
import("./sfmc/dist/sfmc.js").catch((e) => {
  console.error("入口加载失败:", e);
  process.exit(1);
});

