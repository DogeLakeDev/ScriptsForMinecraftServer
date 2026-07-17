/**
 * QQ Bridge — 独立进程
 *
 * 端口:
 *   3002 — WebSocket (LLBot reverse ws)
 */

import { request } from "http";
import { join } from "path";
import { WebSocketServer } from "ws";

// ── 读取配置 ──
const cfgPath = join(__dirname, "..", "..", "configs", "qq_config.json");
let cfg: any = {};
try {
  cfg = JSON.parse(require("fs").readFileSync(cfgPath, "utf-8"));
} catch (e) {
  console.error("[QQBridge] 无法读取配置文件:", e);
  process.exit(1);
}

const ENABLED = true;
const WS_PORT = parseInt(cfg.qq_ws_port || "3002", 10);
const QQ_GROUP_ID = String(cfg.qq_group_id || "");
const LLBOT_HTTP = cfg.llbot_http || "127.0.0.1";
const LLBOT_PORT = cfg.llbot_port || 3004;
const DB_HOST = cfg.db_host || "127.0.0.1";
const DB_PORT = parseInt(cfg.db_port || "3001", 10);
const MCTOQQ_PREFIX = cfg.mctoqq_prefix || "[MC]";
const CHANNEL_ID = cfg.bridge_channel_id || "";

const llbotToken = cfg.llbot_token || "";

function log(msg: string) {
  const ts = new Date().toISOString().replace("T", " ").slice(0, 19);
  console.log(`[${ts}] ${msg}`);
}

// ────────── LLBot HTTP 发送 ──────────

function sendToLLBot(payload: any) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(payload);
    const options: any = {
      hostname: LLBOT_HTTP,
      port: LLBOT_PORT,
      path: "/send_group_msg",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(data),
      },
    };
    if (llbotToken) options.headers["Authorization"] = `Bearer ${llbotToken}`;

    const req = request(options, (res) => {
      let body = "";
      res.on("data", (c) => (body += c));
      res.on("end", () => {
        if (res.statusCode === 200) resolve(body);
        else reject(new Error(`LLBot HTTP ${res.statusCode}: ${body.slice(0, 200)}`));
      });
    });
    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

// ────────── 向 db-server 保存消息 ──────────

function saveToDBServer(channelId: string, fromId: string, fromName: string, content: string) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      messages: [
        {
          id: `${fromId}_${Date.now()}`,
          channelId,
          fromid: fromId,
          fromName,
          type: "text",
          content,
          showTimestamp: true,
          timestamp: Date.now(),
        },
      ],
    });
    const options = {
      hostname: DB_HOST,
      port: DB_PORT,
      path: "/api/sfmc/messages",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(payload),
      },
    };
    const req = request(options, (res) => {
      let body = "";
      res.on("data", (c) => (body += c));
      res.on("end", () => {
        if (res.statusCode === 200) resolve(true);
        else reject(new Error(`db-server ${res.statusCode}: ${body.slice(0, 200)}`));
      });
    });
    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

// ────────── 发送群消息（公开 API） ──────────

async function sendGroupMessage(text: string) {
  if (!ENABLED || !QQ_GROUP_ID) throw new Error("QQ bridge disabled");
  await sendToLLBot({
    group_id: parseInt(QQ_GROUP_ID, 10),
    message: [{ type: "text", data: { text } }],
  });
}

async function sendGroupMixed(segments: string) {
  if (!ENABLED || !QQ_GROUP_ID) throw new Error("QQ bridge disabled");
  await sendToLLBot({
    group_id: parseInt(QQ_GROUP_ID, 10),
    message: segments,
  });
}

// ────────── OneBot 事件处理 ──────────

function extractText(segments: string): any {
  if (typeof segments === "string") return segments;
  if (!Array.isArray(segments)) return "";
}

async function handleOneBotEvent(data: any) {
  if (data.post_type !== "message" || data.message_type !== "group") return;
  if (String(data.group_id) !== QQ_GROUP_ID) return;

  const text = extractText(data.message);
  if (!text) return;

  const sender = data.sender?.card || data.sender?.nickname || `QQ_${data.user_id}`;
  const userId = String(data.user_id);
  const channelId = cfg.bridge_channel_id;

  if (!channelId) {
    log("[QQBridge] bridge_channel_id 未设置，忽略消息");
    return;
  }

  try {
    await saveToDBServer(channelId, `qq_${userId}`, sender, text);
    log(`[QQBridge] QQ → MC: ${sender}: ${text.slice(0, 60)}`);
  } catch (err) {
    log(`[QQBridge] 保存消息失败: ${err}`);
  }
}

// ────────── WebSocket 服务 ──────────

function startWsServer() {
  const wss = new WebSocketServer({ port: WS_PORT });
  log(`[QQBridge] WebSocket 服务启动 ws://0.0.0.0:${WS_PORT}`);
  log(`[QQBridge] 等待 LLBot 连接...`);

  wss.on("connection", (ws, req) => {
    log(`[QQBridge] LLBot 已连接 (${req.url})`);
    ws.on("message", (raw) => {
      try {
        handleOneBotEvent(JSON.parse(raw.toString()));
      } catch (err) {
        log(`[QQBridge] 解析消息失败: ${err}`);
      }
    });
    ws.on("close", () => log("[QQBridge] LLBot 已断开"));
    ws.on("error", (err) => log(`[QQBridge] WebSocket 错误: ${err.message}`));
  });

  wss.on("error", (err) => log(`[QQBridge] WebSocket 服务器错误: ${err.message}`));
}

// ────────── 启动 ──────────

if (!ENABLED) {
  log("[QQBridge] 已禁用 (qq_enabled = false)");
  process.exit(0);
}

startWsServer();

log("[QQBridge] 启动完成");

// ────────── 标准输入命令处理 ──────────

function showQqHelp() {
  console.log("QQ Bridge 可用命令:");
  console.log("  help    — 显示本帮助");
  console.log("  reload  — 重新读取 qq_config.json");
  console.log("  status  — 显示连接状态");
  console.log("  stop    — 停止服务");
}

function reloadQqConfig() {
  try {
    const newCfg = JSON.parse(require("fs").readFileSync(cfgPath, "utf-8"));
    Object.assign(cfg, newCfg);
    console.log("[QQBridge] 配置已重载");
  } catch (e) {
    console.error("[QQBridge] 重载配置失败:", e);
  }
}

import { createInterface } from "readline";
const rl = createInterface({ input: process.stdin, output: process.stdout });
rl.on("line", (line) => {
  const cmd = line.trim().toLowerCase();
  if (cmd === "help") {
    showQqHelp();
  } else if (cmd === "reload") {
    reloadQqConfig();
  } else if (cmd === "status") {
    console.log(`[QQBridge] 状态: ${ENABLED ? "已启用" : "已禁用"}`);
    console.log(`  WebSocket 端口: ${WS_PORT}`);
    console.log(`  LLBot 地址: ${LLBOT_HTTP}`);
    console.log(`  QQ 群号: ${QQ_GROUP_ID}`);
    console.log(`  db-server: ${DB_HOST}:${DB_PORT}`);
  } else if (cmd === "stop") {
    console.log("[QQBridge] 正在停止...");
    rl.close();
    process.exit(0);
  } else {
    console.log(`[QQBridge] 未知命令: ${cmd}，输入 help 查看帮助`);
  }
});
