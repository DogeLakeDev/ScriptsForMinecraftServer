#!/usr/bin/env node
/**
 * main.ts — sfmc-mp-gateway 命令入口
 *
 * 使用场景：在 SFMC 实例所在的服务器上常驻运行，供微信小程序通过 wss/https 管理实例。
 * 只在首次生成访问令牌时把令牌打印一次；之后只提示令牌文件位置，避免令牌反复出现在服务日志里。
 */
import { HELP_TEXT, parseGatewayConfig, type GatewayConfig } from "./config.js";
import { startGateway } from "./server.js";

let config: GatewayConfig | null;
try {
  config = parseGatewayConfig(process.argv.slice(2), process.env);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  console.error("");
  console.error(HELP_TEXT);
  process.exit(1);
}
if (!config) {
  console.log(HELP_TEXT);
  process.exit(0);
}

const gateway = await startGateway(config);
console.log(`SFMC 小程序网关已启动: http://${config.host}:${config.port}`);
console.log(`  实例目录  ${config.root}`);
console.log(`  CLI 入口  ${config.entry}`);
if (config.tokenSource === "generated") {
  console.log(`  已生成访问令牌（保存在 ${config.tokenFile}）:`);
  console.log(`  ${config.token}`);
} else if (config.tokenSource === "file") {
  console.log(`  访问令牌  见 ${config.tokenFile}`);
} else {
  console.log(`  访问令牌  来自${config.tokenSource === "argument" ? "命令行参数" : "环境变量"}`);
}
if (config.wechat) {
  console.log(`  微信登录  已启用（AppId ${config.wechat.appId}，db-server ${config.dbUrl}）`);
} else {
  console.log("  微信登录  未启用（设置 SFMC_MP_WX_APPID 与 SFMC_MP_WX_SECRET 后，玩家端与按角色授权管理端才可用）");
}
console.log(config.mapUrl ? `  地图服务  ${config.mapUrl}` : "  地图服务  未开启（实例没有 configs/bluemap.json，可用 --map-url 指定）");
if (config.host !== "127.0.0.1" && config.host !== "localhost" && config.host !== "::1") {
  console.log("  注意：网关直接监听非本机地址。小程序正式版只能访问 https/wss，请在前面配置 TLS 反向代理。");
}

let stopping = false;
const stop = () => {
  if (stopping) return;
  stopping = true;
  void gateway.close().finally(() => process.exit(0));
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
