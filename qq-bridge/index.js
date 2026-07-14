/**
 * QQ Bridge — 独立进程
 *
 * 接收 LLBot (OneBot 11) 的 WebSocket 连接
 * 并提供 HTTP 接口供 db-server 和 BDSTools 调用
 *
 * 端口:
 *   3002 — WebSocket (LLBot reverse ws)
 *   3003 — HTTP (db-server forward + 外部工具调用)
 */

const { WebSocketServer } = require('ws');
const http = require('http');
const path = require('path');

// ── 读取配置 ──
const cfgPath = path.join(__dirname, '..', 'configs', 'qq_config.json');
let cfg;
try {
  cfg = JSON.parse(require('fs').readFileSync(cfgPath, 'utf-8'));
} catch (e) {
  console.error('[QQBridge] 无法读取配置文件:', e.message);
  process.exit(1);
}

const ENABLED = true;
const WS_PORT = parseInt(cfg.qq_ws_port || '3002', 10);
const HTTP_PORT = parseInt(cfg.qq_bridge_port || '3003', 10);
const QQ_GROUP_ID = String(cfg.qq_group_id || '');
const LLBOT_HTTP = cfg.llbot_http || '127.0.0.1';
const LLBOT_PORT = cfg.llbot_port || 3004;
const DB_HOST = cfg.db_host || '127.0.0.1';
const DB_PORT = parseInt(cfg.db_port || '3001', 10);
const MCTOQQ_PREFIX = cfg.mctoqq_prefix || '[MC]';
const CHANNEL_ID = cfg.bridge_channel_id || '';

const llbotToken = cfg.llbot_token || '';

function log(msg) {
  const ts = new Date().toISOString().replace('T', ' ').slice(0, 19);
  console.log(`[${ts}] ${msg}`);
}

// ────────── LLBot HTTP 发送 ──────────

function sendToLLBot(payload) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(payload);
    const options = {
      hostname: LLBOT_HTTP,
      port: LLBOT_PORT || 3000,
      path: '/send_group_msg',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
      },
    };
    if (llbotToken) options.headers['Authorization'] = `Bearer ${llbotToken}`;

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => {
        if (res.statusCode === 200) resolve(body);
        else reject(new Error(`LLBot HTTP ${res.statusCode}: ${body.slice(0, 200)}`));
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

// ────────── 向 db-server 保存消息 ──────────

function saveToDBServer(channelId, fromId, fromName, content) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      messages: [{
        id: `${fromId}_${Date.now()}`,
        channelId,
        fromid: fromId,
        fromName,
        type: 'text',
        content,
        showTimestamp: true,
        timestamp: Date.now(),
      }],
    });
    const options = {
      hostname: DB_HOST,
      port: DB_PORT,
      path: '/api/sfmc/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
    };
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => {
        if (res.statusCode === 200) resolve();
        else reject(new Error(`db-server ${res.statusCode}: ${body.slice(0, 200)}`));
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

// ────────── 发送群消息（公开 API） ──────────

async function sendGroupMessage(text) {
  if (!ENABLED || !QQ_GROUP_ID) throw new Error('QQ bridge disabled');
  await sendToLLBot({
    group_id: parseInt(QQ_GROUP_ID, 10),
    message: [{ type: 'text', data: { text } }],
  });
}

async function sendGroupMixed(segments) {
  if (!ENABLED || !QQ_GROUP_ID) throw new Error('QQ bridge disabled');
  await sendToLLBot({
    group_id: parseInt(QQ_GROUP_ID, 10),
    message: segments,
  });
}

// ────────── OneBot 事件处理 ──────────

function extractText(segments) {
  if (typeof segments === 'string') return segments;
  if (!Array.isArray(segments)) return '';
  return segments
    .filter((s) => s.type === 'text')
    .map((s) => s.data?.text || '')
    .join('')
    .trim();
}

async function handleOneBotEvent(data) {
  if (data.post_type !== 'message' || data.message_type !== 'group') return;
  if (String(data.group_id) !== QQ_GROUP_ID) return;

  const text = extractText(data.message);
  if (!text) return;

  const sender = data.sender?.card || data.sender?.nickname || `QQ_${data.user_id}`;
  const userId = String(data.user_id);
  const channelId = cfg.bridge_channel_id;

  if (!channelId) {
    log('[QQBridge] bridge_channel_id 未设置，忽略消息');
    return;
  }

  try {
    await saveToDBServer(channelId, `qq_${userId}`, sender, text);
    log(`[QQBridge] QQ → MC: ${sender}: ${text.slice(0, 60)}`);
  } catch (err) {
    log(`[QQBridge] 保存消息失败: ${err.message}`);
  }
}

// ────────── WebSocket 服务 ──────────

function startWsServer() {
  const wss = new WebSocketServer({ port: WS_PORT });
  log(`[QQBridge] WebSocket 服务启动 ws://0.0.0.0:${WS_PORT}`);
  log(`[QQBridge] 等待 LLBot 连接...`);

  wss.on('connection', (ws, req) => {
    log(`[QQBridge] LLBot 已连接 (${req.url})`);
    ws.on('message', (raw) => {
      try {
        handleOneBotEvent(JSON.parse(raw.toString()));
      } catch (err) {
        log(`[QQBridge] 解析消息失败: ${err.message}`);
      }
    });
    ws.on('close', () => log('[QQBridge] LLBot 已断开'));
    ws.on('error', (err) => log(`[QQBridge] WebSocket 错误: ${err.message}`));
  });

  wss.on('error', (err) => log(`[QQBridge] WebSocket 服务器错误: ${err.message}`));
}

// ────────── HTTP 服务（供 db-server / BDSTools 调用） ──────────

function startHttpServer() {
  const AUTH_TOKEN = cfg.bridge_auth_token || '';
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const path = url.pathname;
    const method = req.method.toUpperCase();

    const json = (data, status = 200) => {
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(data));
    };
    const body = (r) => new Promise((rs, rj) => {
      let d = '';
      r.on('data', (c) => (d += c));
      r.on('end', () => {
        try { rs(JSON.parse(d)); } catch { rs({}); }
      });
      r.on('error', rj);
    });

    // 强制 loopback 绑定，仅允许本机访问
    const remote = req.socket.remoteAddress || '';
    if (remote && !remote.startsWith('127.') && remote !== '::1' && remote !== '::ffff:127.') {
      json({ success: false, error: 'forbidden' }, 403);
      return;
    }

    // ── GET /health ──
    if (path === '/health' && method === 'GET') {
      json({ status: 'ok', uptime: process.uptime() });
      return;
    }

    // 鉴权（除 /health 外的所有写接口）
    if (AUTH_TOKEN) {
      const auth = req.headers['authorization'] || '';
      const provided = auth.startsWith('Bearer ') ? auth.slice(7) : (req.headers['x-bridge-token'] || '');
      if (provided !== AUTH_TOKEN) {
        json({ success: false, error: 'unauthorized' }, 401);
        return;
      }
    }

    // 请求体大小限制（默认 256KB）
    const MAX_BODY = parseInt(cfg.bridge_max_body || '262144', 10);
    let received = 0;
    req.on('data', (chunk) => {
      received += chunk.length;
      if (received > MAX_BODY) {
        req.destroy();
        json({ success: false, error: 'payload_too_large' }, 413);
      }
    });

    // ── POST /forward — 来自 db-server 的消息转发到 QQ ──
    if (path === '/forward' && method === 'POST') {
      try {
        const data = await body(req);
        if (!data.fromName && !data.content) {
          json({ success: false, error: 'invalid' }, 400);
          return;
        }
        // Loop prevention — skip qq_ originated messages
        if (data.fromId && String(data.fromId).startsWith('qq_')) {
          json({ success: true, skipped: true });
          return;
        }
        if (data.channelId !== CHANNEL_ID || !CHANNEL_ID) {
          json({ success: true, skipped: true });
        }
        await sendGroupMessage(`${MCTOQQ_PREFIX} ${data.fromName}: ${data.content}`);
        json({ success: true });
        log(`[QQBridge] MC → QQ: ${data.fromName}: ${data.content.slice(0, 60)}`);
      } catch (err) {
        log(`[QQBridge] forward 失败: ${err.message}`);
        json({ success: false, error: err.message }, 500);
      }
      return;
    }

    // ── POST /send — 外部工具直接发消息（BDSTools etc.） ──
    if (path === '/send' && method === 'POST') {
      try {
        const data = await body(req);
        if (data.segments && Array.isArray(data.segments)) {
          await sendGroupMixed(data.segments);
        } else if (data.text) {
          await sendGroupMessage(data.text);
        } else {
          json({ success: false, error: 'need text or segments' }, 400);
          return;
        }
        json({ success: true });
      } catch (err) {
        log(`[QQBridge] send 失败: ${err.message}`);
        json({ success: false, error: err.message }, 500);
      }
      return;
    }

    json({ success: false, error: 'not_found' }, 404);
  });

  server.listen(HTTP_PORT, '127.0.0.1', () => {
    log(`[QQBridge] HTTP 服务启动 http://127.0.0.1:${HTTP_PORT}`);
    log(`[QQBridge] 可用接口: POST /forward, POST /send, GET /health`);
    log(`[QQBridge] 鉴权: ${AUTH_TOKEN ? '已启用 token' : '未启用'}`);
  });
}

// ────────── 启动 ──────────

if (!ENABLED) {
  log('[QQBridge] 已禁用 (qq_enabled = false)');
  process.exit(0);
}

startWsServer();
startHttpServer();

log('[QQBridge] 启动完成');

// ────────── 标准输入命令处理 ──────────

function showQqHelp() {
  console.log('QQ Bridge 可用命令:');
  console.log('  help    — 显示本帮助');
  console.log('  reload  — 重新读取 qq_config.json');
  console.log('  status  — 显示连接状态');
  console.log('  stop    — 停止服务');
}

function reloadQqConfig() {
  try {
    const newCfg = JSON.parse(require('fs').readFileSync(cfgPath, 'utf-8'));
    Object.assign(cfg, newCfg);
    console.log('[QQBridge] 配置已重载');
  } catch (e) {
    console.error('[QQBridge] 重载配置失败:', e.message);
  }
}

const readline = require('readline');
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
rl.on('line', (line) => {
  const cmd = line.trim().toLowerCase();
  if (cmd === 'help') {
    showQqHelp();
  } else if (cmd === 'reload') {
    reloadQqConfig();
  } else if (cmd === 'status') {
    console.log(`[QQBridge] 状态: ${ENABLED ? '已启用' : '已禁用'}`);
    console.log(`  WebSocket 端口: ${WS_PORT}`);
    console.log(`  HTTP 端口: ${HTTP_PORT}`);
    console.log(`  LLBot 地址: ${LLBOT_HTTP}`);
    console.log(`  QQ 群号: ${QQ_GROUP_ID}`);
    console.log(`  db-server: ${DB_HOST}:${DB_PORT}`);
  } else if (cmd === 'stop') {
    console.log('[QQBridge] 正在停止...');
    rl.close();
    process.exit(0);
  } else {
    console.log(`[QQBridge] 未知命令: ${cmd}，输入 help 查看帮助`);
  }
});
