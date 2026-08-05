# 使用步骤

1.复制 http-client.private.env.json.example → http-client.private.env.json
2.填入 httpAuth、moduleToken 等（来源见 health.http 顶部注释）
3.状态栏选择 REST Client 环境 local
4.打开对应 .http，点 Send Request

> 说明： qq-bridge 只有 WS（3002），没有 HTTP，故无对应文件。db.http / services.http 的 moduleId、moduleToken、表名须与本机已启用模块一致，否则会 401/403。
