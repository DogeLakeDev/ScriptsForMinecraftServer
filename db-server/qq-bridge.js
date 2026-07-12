/**
 * QQ Bridge — LLBot (OneBot 11) integration for DogeChat
 *
 * Receives QQ group messages via reverse WebSocket,
 * forwards Minecraft channel messages to QQ via HTTP API.
 */

const { WebSocketServer } = require('ws');
const http = require('http');
const ENABLED = process.env.QQ_ENABLED == 'true';
const WS_PORT = parseInt(process.env.QQ_WS_PORT || '3002', 10);
const LLBOT_HTTP = process.env.LLBOT_HTTP || 'http://127.0.0.1:3002';
const QQ_GROUP_ID = process.env.QQ_GROUP_ID || '';
const BRIDGE_CHANNEL_ID = process.env.BRIDGE_CHANNEL_ID || '';
const LLBOT_TOKEN = process.env.LLBOT_TOKEN || '';
const MCTOQQ_PREFIX = process.env.MCTOQQ_PREFIX || '[MC]';

// Parse LLBOT_HTTP into components
const llbotUrl = new URL(LLBOT_HTTP);

let db;
let wss = null;
let log = () => {};

/**
 * Initialize the QQ bridge
 * @param {import('better-sqlite3').Database} database
 * @param {Function} logger
 */
function init(database, logger) {
  db = database;
  log = logger || console.log;

  if (!ENABLED) {
    log('[QQBridge] Disabled (QQ_ENABLED != true)');
    return;
  }

  if (!QQ_GROUP_ID) {
    log('[QQBridge] QQ_GROUP_ID not set, bridge disabled');
    return;
  }

  if (!BRIDGE_CHANNEL_ID) {
    log('[QQBridge] BRIDGE_CHANNEL_ID not set, bridge disabled');
    return;
  }
  log('[QQBridge] Enabled! ');
  startWsServer();
}

function startWsServer() {
  wss = new WebSocketServer({ port: WS_PORT });
  log(`[QQBridge] WebSocket server listening on ws://127.0.0.1:${WS_PORT}/qq`);
  log(`[QQBridge] 等待LLBOT端开放连接...`);

  wss.on('connection', (ws, req) => {
    const url = req.url || '';
    log(`[QQBridge] LLBot connected via ${url}`);

    ws.on('message', (raw) => {
      try {
        const data = JSON.parse(raw.toString());
        handleOneBotEvent(data);
      } catch (err) {
        log(`[QQBridge] Failed to parse message: ${err.message}`);
      }
    });

    ws.on('close', () => {
      log('[QQBridge] LLBot disconnected');
    });

    ws.on('error', (err) => {
      log(`[QQBridge] WebSocket error: ${err.message}`);
    });
  });

  wss.on('error', (err) => {
    log(`[QQBridge] WebSocket server error: ${err.message}`);
  });
}

/**
 * Handle OneBot 11 event from LLBot
 */
function handleOneBotEvent(data) {
  // Only handle group messages
  if (data.post_type === 'message' && data.message_type === 'group') {
    const groupId = String(data.group_id);
    if (groupId !== QQ_GROUP_ID) return;

    // Extract text content from message array format
    const text = extractText(data.message);
    if (!text) return;

    const sender = data.sender?.card || data.sender?.nickname || `QQ_${data.user_id}`;
    const userId = String(data.user_id);

    // Save to SQLite
    saveQQMessage(userId, sender, text);
  }
}

/**
 * Extract plain text from OneBot 11 array message format
 */
function extractText(segments) {
  if (typeof segments === 'string') return segments;
  if (!Array.isArray(segments)) return '';
  return segments
    .filter((s) => s.type === 'text')
    .map((s) => s.data?.text || '')
    .join('')
    .trim();
}

/**
 * Save a QQ message into the bridge channel via direct INSERT
 */
function saveQQMessage(userId, senderName, text) {
  try {
    const id = `QQ_${userId}_${Date.now()}`;
    const now = Date.now();
    db.prepare(
      `INSERT INTO sfmc_chat_messages (id, channel_id, from_id, from_name, type, content, show_timestamp, created_at)
       VALUES (?, ?, ?, ?, 'text', ?, 1, ?)`
    ).run(id, BRIDGE_CHANNEL_ID, `qq_${userId}`, senderName, text, now);
    log(`[QQBridge] QQ → MC: ${senderName}: ${text.slice(0, 60)}`);
  } catch (err) {
    log(`[QQBridge] Failed to save QQ message: ${err.message}`);
  }
}

/**
 * Forward a Minecraft message to QQ group.
 * Called by index.js after a message is saved.
 * @param {string} channelId
 * @param {string} fromName
 * @param {string} content
 * @param {string} fromId
 */
function forwardToQQ(channelId, fromName, content, fromId) {
  if (!ENABLED || !QQ_GROUP_ID) return;
  if (channelId !== BRIDGE_CHANNEL_ID) return;
  // Skip messages from QQ itself (loop prevention)
  if (fromId && fromId.startsWith('qq_')) return;

  const payload = JSON.stringify({
    group_id: parseInt(QQ_GROUP_ID, 10),
    message: [
      {
        type: 'text',
        data: { text: `${MCTOQQ_PREFIX} ${fromName}: ${content}` },
      },
    ],
  });

  const options = {
    hostname: llbotUrl.hostname,
    port: llbotUrl.port || 3000,
    path: '/send_group_msg',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload),
    },
  };

  if (LLBOT_TOKEN) {
    options.headers['Authorization'] = `Bearer ${LLBOT_TOKEN}`;
  }

  const req = http.request(options, (res) => {
    if (res.statusCode !== 200) {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => log(`[QQBridge] LLBot HTTP ${res.statusCode}: ${body.slice(0, 100)}`));
    }
  });

  req.on('error', (err) => log(`[QQBridge] Failed to send to QQ: ${err.message}`));
  req.write(payload);
  req.end();
}

/**
 * Close the WebSocket server (for cleanup on shutdown)
 */
function shutdown() {
  if (wss) wss.close();
}

module.exports = { init, forwardToQQ, shutdown };
