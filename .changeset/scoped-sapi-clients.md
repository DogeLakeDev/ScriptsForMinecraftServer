---
"@sfmc-bds/sdk": patch
"@sfmc-bds/create-module": patch
---

fix(sdk): 作用域 db/config/service 客户端，消除多模块身份串桶与全局事务互斥

- 新增 createDbClient / createConfigClient / createServiceClient：身份与 tx 状态封闭在闭包
- 单例 db/config/service 改为按 moduleId 登记表转发（兼容旧代码）
- ModuleRegistry lifecycle 注入 ModuleServices；install 装配配对 inTx 探针
- create-module 模板引导闭包捕获 services.db
