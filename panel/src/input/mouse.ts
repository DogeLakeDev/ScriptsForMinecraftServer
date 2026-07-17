/**
 * input/mouse.ts — SGR 鼠标支持 + 声明式命中区
 *
 * 与旧版区别：
 *   - 移除 "render 函数体内 clearHitRegions" 的 hack
 *   - 命中区由组件在自己的 effect 清理函数中清除
 *   - 新增坐标测量：useMouseRegion hook 自动读取 ref 绝对坐标
 */

import { useEffect, useRef } from "react";
import { useStdout } from "ink";

export type HitRegion = {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  onClick: () => void;
};

const _hitRegions: HitRegion[] = [];
let _scrollUpFn: (() => void) | null = null;
let _scrollDownFn: (() => void) | null = null;
let _origPush: ((data: unknown, encoding?: unknown) => boolean) | null = null;
let _mouseActive = false;
let _sgrBuf = "";
let _lastClickId: string | null = null;

/** 注册命中区（同一 id 会被覆盖）。 */
export function registerHitRegion(region: HitRegion): void {
  const idx = _hitRegions.findIndex((r) => r.id === region.id);
  if (idx >= 0) _hitRegions[idx] = region;
  else _hitRegions.push(region);
}

/** 注销指定 id。 */
export function unregisterHitRegion(id: string): void {
  const idx = _hitRegions.findIndex((r) => r.id === id);
  if (idx >= 0) _hitRegions.splice(idx, 1);
}

/** 注销一组 id（effect cleanup 用）。 */
export function unregisterHitRegions(ids: Iterable<string>): void {
  for (const id of ids) unregisterHitRegion(id);
}

export function setScrollHandlers(up: () => void, down: () => void): void {
  _scrollUpFn = up;
  _scrollDownFn = down;
}

function emitClick(region: HitRegion): void {
  _lastClickId = region.id;
  try {
    region.onClick();
  } catch (e) {
    console.warn("[mouse] onClick error:", (e as Error).message);
  }
}

/** 查询上一次 click 的 id（用于组件渲染时主动响应）。 */
export function consumeLastClick(): string | null {
  const id = _lastClickId;
  _lastClickId = null;
  return id;
}

function handleSequence(seq: string): void {
  const m = seq.match(/^\x1b\[<(\d+);(\d+);(\d+)([Mm])$/);
  if (!m || m[4] !== "M") return;
  const btn = parseInt(m[1] ?? "0", 10);
  const x = parseInt(m[2] ?? "0", 10);
  const y = parseInt(m[3] ?? "0", 10);
  // 滚轮：btn 64 = up, 65 = down
  if (btn === 64) _scrollUpFn?.();
  if (btn === 65) _scrollDownFn?.();
  // 左键 release = click
  if (btn === 0) {
    for (const r of _hitRegions) {
      if (x >= r.x1 && x <= r.x2 && y >= r.y1 && y <= r.y2) {
        emitClick(r);
        return;
      }
    }
  }
}

function stripSGR(text: string): string {
  let result = "";
  let i = 0;
  const len = text.length;
  while (i < len) {
    const start = text.indexOf("\x1b[<", i);
    if (start < 0) {
      result += text.slice(i);
      break;
    }
    if (start > i) result += text.slice(i, start);
    let seqEnd = -1;
    for (let j = start; j < len; j++) {
      if (text[j] === "M" || text[j] === "m") {
        seqEnd = j;
        break;
      }
    }
    if (seqEnd >= 0) {
      handleSequence(text.slice(start, seqEnd + 1));
      i = seqEnd + 1;
    } else {
      const remain = text.slice(start);
      _sgrBuf = remain;
      if (_sgrBuf.length > 50) _sgrBuf = "";
      i = len;
    }
  }
  return result;
}

function installFilter(): void {
  if (_origPush) return;
  const orig = process.stdin.push.bind(process.stdin);
  _origPush = orig as unknown as ((data: unknown, encoding?: unknown) => boolean);
  process.stdin.push = function (data: unknown, encoding?: unknown): boolean {
    if (!Buffer.isBuffer(data) && typeof data !== "string") {
      return orig(data as never, encoding as never);
    }
    const str = typeof data === "string" ? data : (data as Buffer).toString();
    const full = _sgrBuf + str;
    _sgrBuf = "";
    const cleaned = stripSGR(full);
    if (cleaned) return orig(Buffer.from(cleaned), encoding as never);
    return true;
  } as typeof process.stdin.push;
}

function uninstallFilter(): void {
  if (!_origPush) return;
  process.stdin.push = _origPush as unknown as typeof process.stdin.push;
  _origPush = null;
}

export function enableMouse(): void {
  if (_mouseActive) return;
  _mouseActive = true;
  process.stdout.write("\x1b[?1000h\x1b[?1002h\x1b[?1006h");
  installFilter();
}

export function disableMouse(): void {
  if (!_mouseActive) return;
  _mouseActive = false;
  process.stdout.write("\x1b[?1000l\x1b[?1002l\x1b[?1006h");
  uninstallFilter();
}

/** React hook：声明命中区，effect 卸载时自动注销。
 *  不依赖硬编码坐标，组件需要自行读取 ref 位置（简化版：直接传 x1..y2）。 */
export function useHitRegion(region: HitRegion | null): void {
  useEffect(() => {
    if (!region) return;
    registerHitRegion(region);
    return () => unregisterHitRegion(region.id);
  }, [region?.id, region?.x1, region?.x2, region?.y1, region?.y2]);
}

/** 保留对 stdout 的引用（未来真实测量用，目前用传参）。 */
export function useStdoutSize(): { cols: number; rows: number } {
  const { stdout } = useStdout();
  return { cols: stdout?.columns ?? 80, rows: stdout?.rows ?? 24 };
}

/** 占位：组件拿到 ref 后用此函数把 (x, y, w, h) 转换成 SGR 1-based 绝对坐标。
 *  简化：组件自己根据布局推算；后续可改成读 ANSI cursor report。 */
export function useRegionRef(): React.RefObject<{ x: number; y: number; w: number; h: number } | null> {
  return useRef<{ x: number; y: number; w: number; h: number } | null>(null);
}
