/**
 * mouse.js — SGR 鼠标滚轮支持 + 右键检测
 *
 * 原理: 覆写 process.stdin.push 在数据进入可读流之前拦截 SGR 鼠标序列,
 *       剥离字节使其永远不会到达 Ink/useInput。
 */
import { logBuf } from './log-buffer.js';

let _scrollSetter = null;
let _mouseActive = false;
let _rightClickFn = null;

// SGR 分片缓冲（跨 chunk 的不完整序列）
let _sgrBuf = '';

function isMouseActive() { return false; } // 不再需要，stdin 层已剥离

function onRightClick(fn) { _rightClickFn = fn; }

/**
 * 处理一条完整的 SGR 鼠标序列
 */
function _handleSequence(seq) {
  const m = seq.match(/^\x1b\[<(\d+);(\d+);(\d+)([Mm])$/);
  if (!m) return;
  if (m[4] !== 'M') return;
  const btn = parseInt(m[1]);
  if (btn === 64 && _scrollSetter) { _scrollSetter((s) => Math.min(logBuf.length, s + 3)); }
  else if (btn === 65 && _scrollSetter) { _scrollSetter((s) => Math.max(0, s - 3)); }
  else if (btn === 2 && _rightClickFn) { _rightClickFn(); }
}

/**
 * 从字符串中剥离完整/不完整的 SGR 鼠标序列
 * 返回 { cleaned, remain } — cleaned 是过滤后的文本, remain 是跨 chunk 残余
 */
function _stripSGR(text) {
  let result = '';
  let i = 0;
  const len = text.length;

  while (i < len) {
    // 查找 \x1b[<
    const start = text.indexOf('\x1b[<', i);
    if (start < 0) { result += text.slice(i); break; }

    // 复制 \x1b[< 之前的普通文本
    if (start > i) result += text.slice(i, start);

    // 从 start 开始查找完整的序列结束符 M/m
    let seqEnd = -1;
    for (let j = start; j < len; j++) {
      if (text[j] === 'M' || text[j] === 'm') { seqEnd = j; break; }
    }

    if (seqEnd >= 0) {
      // 找到完整序列 → 处理并跳过
      const seq = text.slice(start, seqEnd + 1);
      _handleSequence(seq);
      i = seqEnd + 1;
    } else {
      // 不完整序列 → 剩余部分作为缓冲
      const remain = text.slice(start);
      _sgrBuf = remain;
      if (_sgrBuf.length > 50) _sgrBuf = ''; // 防溢出
      i = len; // 跳过剩余部分
    }
  }

  return result;
}

/**
 * 覆写 process.stdin.push 以在数据进入可读流之前剥离 SGR 鼠标序列
 */
let _origPush = null;

function _installFilter() {
  if (_origPush) return; // 只安装一次
  _origPush = process.stdin.push.bind(process.stdin);
  const self = this;

  process.stdin.push = function (data, encoding) {
    // 只处理 Buffer 数据
    if (!Buffer.isBuffer(data) && typeof data !== 'string') {
      return _origPush(data, encoding);
    }

    const str = typeof data === 'string' ? data : data.toString();

    // 拼接上一次的残余
    const full = _sgrBuf + str;
    _sgrBuf = '';

    const cleaned = _stripSGR(full);

    // 只在有实际文本时才 push
    if (cleaned) {
      return _origPush(Buffer.from(cleaned), encoding);
    }
    return true; // 全部被过滤
  };
}

function _uninstallFilter() {
  if (!_origPush) return;
  process.stdin.push = _origPush;
  _origPush = null;
}

// ── API ──

function hookMouse(setScroll) {
  _scrollSetter = setScroll;
}

function enableMouse() {
  if (_mouseActive) return;
  _mouseActive = true;
  process.stdout.write('\x1b[?1000h\x1b[?1002h\x1b[?1006h');
  _installFilter();
}

function disableMouse() {
  if (!_mouseActive) return;
  _mouseActive = false;
  process.stdout.write('\x1b[?1000l\x1b[?1002l\x1b[?1006l');
  _uninstallFilter();
}

export { hookMouse, enableMouse, disableMouse, isMouseActive, onRightClick };
