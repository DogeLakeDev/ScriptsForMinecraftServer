/**
 * llbot-sender — QQ 消息发送工具
 *
 * 读取 configs/qq_config.json，通过 LLBot HTTP API 发送群消息。
 * 供 check-update.js 和外部工具使用。
 * 模块开关由 configs/modules.json 的 qq_bridge 控制。
 */

const http = require('http');
const path = require('path');
const fs = require('fs');

function loadConfig() {
  const cfgPath = path.join(__dirname, '..', 'configs', 'qq_config.json');
  try {
    return JSON.parse(fs.readFileSync(cfgPath, 'utf-8'));
  } catch (e) {
    throw new Error(`无法读取 ${cfgPath}: ${e.message}`);
  }
}

function isModuleEnabled() {
  try {
    const raw = fs.readFileSync(path.join(__dirname, '..', 'configs', 'modules.json'), 'utf-8');
    const d = JSON.parse(raw);
    return d.modules?.qq_bridge !== false;
  } catch { return true; }
}

let _cfg = null;
function getConfig() {
  if (!_cfg) _cfg = loadConfig();
  return _cfg;
}

function sendToLLBot(payload) {
  return new Promise((resolve, reject) => {
    const cfg = getConfig();
    const url = new URL(cfg.llbot_http || 'http://127.0.0.1:3000');
    const data = JSON.stringify(payload);
    const options = {
      hostname: url.hostname,
      port: url.port || 3000,
      path: '/send_group_msg',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
      },
    };
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

/**
 * 发送纯文本群消息
 * @param {string} text
 */
async function sendText(text) {
  const cfg = getConfig();
  if (!isModuleEnabled() || !cfg.qq_group_id) throw new Error('QQ bridge disabled (qq_bridge=false)');
  await sendToLLBot({
    group_id: parseInt(cfg.qq_group_id, 10),
    message: [{ type: 'text', data: { text } }],
  });
}

/**
 * 发送混合消息（文本 + 图片等）
 * @param {Array} segments — OneBot 11 消息段数组
 */
async function sendMixed(segments) {
  const cfg = getConfig();
  if (!isModuleEnabled() || !cfg.qq_group_id) throw new Error('QQ bridge disabled (qq_bridge=false)');
  await sendToLLBot({
    group_id: parseInt(cfg.qq_group_id, 10),
    message: segments,
  });
}

/**
 * 发送带图片的群消息（图片为 base64）
 * @param {string} text 文本内容
 * @param {string} base64Img 图片 base64 数据（不含 data: 前缀）
 */
async function sendWithImage(text, base64Img) {
  const segments = [];
  if (text) segments.push({ type: 'text', data: { text } });
  if (base64Img) segments.push({ type: 'image', data: { file: `base64://${base64Img}` } });
  await sendMixed(segments);
}

module.exports = { sendText, sendMixed, sendWithImage };
