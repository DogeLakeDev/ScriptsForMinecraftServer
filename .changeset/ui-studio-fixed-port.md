---
"@sfmc-bds/sdk": patch
"@sfmc-bds/cli": patch
---

UI Studio 改为固定监听 `127.0.0.1:3003`，避免每次随机端口导致浏览器 IndexedDB 工程丢失。
