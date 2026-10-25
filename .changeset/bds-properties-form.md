---
"@sfmc-bds/management": minor
"@sfmc-bds/bds-tools": minor
"@sfmc-bds/cli": minor
---

配置页的「BDS配置」（server.properties）表单覆盖平台收录的全部属性，按基本、玩家、网络、性能、反作弊、脚本调试、诊断分组，并显示中文名称、说明、可选值与取值范围。平台读取 server.properties 时随 config.read 下发字段清单，桌面端和小程序使用同一份清单；旧平台没有字段清单时仍显示原来的常用字段。属性当前值不符合字段类型时，表单改用文本框或保留原值选项，不会改写原值。
