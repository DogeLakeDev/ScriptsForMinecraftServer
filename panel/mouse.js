/**
 * mouse.js — SGR 鼠标滚轮 + 鼠标点击支持
 *
 * 原理: 覆写 process.stdin.push 在数据进入可读流之前拦截 SGR 鼠标序列,
 *       剥离字节使其永远不会到达 Ink/useInput。
 */
import { logBuf } from './log-buffer.js';

let _scrollSetter = null;
let _mouseActive = false;

// SGR 分片缓冲（跨 chunk 的不完整序列）
let _sgrBuf = '';

// 点击命中区域: { id, x1, y1, x2, y2, onClick }
const _hitRegions = [];
let _lastClick = null;

function isMouseActive() { return _mouseActive; }

function emitClick(region, x, y) {
  _lastClick = { id: region.id, x, y, at: Date.now() };
  try { region.onClick(x, y); } catch (e) { console.warn('[mouse] onClick error:', e.message); }
}

/**
 * 处理一条完整的 SGR 鼠标序列
 */
function _handleSequence(seq) {
  const m = seq.match(/^\x1b\[<(\d+);(\d+);(\d+)([Mm])$/);
  if (!m) return;
  if (m[4] !== 'M') return;
  const btn = parseInt(m[1]);
  const x = parseInt(m[2]);
  const y = parseInt(m[3]);
  if (btn === 64 && _scrollSetter) { _scrollSetter((s) => Math.min(logBuf.length, s + 3)); return; }
  if (btn === 65 && _scrollSetter) { _scrollSetter((s) => Math.max(0, s - 3)); return; }
  // button=0 是左键释放（MouseRelease），按下时是 btn=32。我们用 m-press + release 来模拟 click
  // 也支持 button=0 (PRESS=0, RELEASE=0)
  if (btn === 0 || btn === 32) {
    // find hit region
    for (const r of _hitRegions) {
      if (x >= r.x1 && x <= r.x2 && y >= r.y1 && y <= r.y2) {
        emitClick(r, x, y);
        break;
      }
    }
  }
}

/**
 * 从字符串中剥离完整/不完整的 SGR 鼠标序列
 */
function _stripSGR(text) {
  let result = '';
  let i = 0;
  const len = text.length;

  while (i < len) {
    const start = text.indexOf('\x1b[<', i);
    if (start < 0) { result += text.slice(i); break; }
    if (start > i) result += text.slice(i, start);

    let seqEnd = -1;
    for (let j = start; j < len; j++) {
      if (text[j] === 'M' || text[j] === 'm') { seqEnd = j; break; }
    }

    if (seqEnd >= 0) {
      const seq = text.slice(start, seqEnd + 1);
      _handleSequence(seq);
      i = seqEnd + 1;
    } else {
      const remain = text.slice(start);
      _sgrBuf = remain;
      if (_sgrBuf.length > 50) _sgrBuf = '';
      i = len;
    }
  }

  return result;
}

/**
 * 覆写 process.stdin.push
 */
let _origPush = null;

function _installFilter() {
  if (_origPush) return;
  _origPush = process.stdin.push.bind(process.stdin);

  process.stdin.push = function (data, encoding) {
    if (!Buffer.isBuffer(data) && typeof data !== 'string') {
      return _origPush(data, encoding);
    }
    const str = typeof data === 'string' ? data : data.toString();
    const full = _sgrBuf + str;
    _sgrBuf = '';
    const cleaned = _stripSGR(full);
    if (cleaned) {
      return _origPush(Buffer.from(cleaned), encoding);
    }
    return true;
  };
}

function _uninstallFilter() {
  if (!_origPush) return;
  process.stdin.push = _origPush;
  _origPush = null;
}

function hookMouse(setScroll) {
  _scrollSetter = setScroll;
}

/**
 * 注册可点击命中区域。
 * coordinate 都是 1-based SGR (左上为 1,1)。
 * 可由多个组件共享同一个 region id（重复 click 都会触发）。
 */
function registerHitRegion(region) {
  if (!region || !region.id) return;
  _hitRegions.push(region);
}

function clearHitRegions() {
  _hitRegions.length = 0;
}

function consumeLastClick(id) {
  if (_lastClick && _lastClick.id === id) {
    _lastClick = null;
    return true;
  }
  return false;
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

export { hookMouse, enableMouse, disableMouse, isMouseActive, registerHitRegion, clearHitRegions, consumeLastClick };
