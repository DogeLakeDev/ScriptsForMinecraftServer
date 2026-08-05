/**
 * 监听模块 sapi/src，防抖后回调 onRebuild（由调用方注入 rebuildAndDeploy / 其它）。
 */

import fs from "node:fs";
import path from "node:path";

export interface ModuleWatchOptions {
  moduleRoot: string;
  debounceMs?: number;
  log?: (line: string) => void;
  onRebuild: () => Promise<{ ok: boolean; message?: string }>;
}

export function startModuleWatch(opts: ModuleWatchOptions): { stop: () => void } {
  const log = opts.log ?? ((line: string) => console.log(line));
  const debounceMs = opts.debounceMs ?? 200;
  const sapiDir = path.join(opts.moduleRoot, "sapi");
  const srcDir = path.join(sapiDir, "src");

  if (!fs.existsSync(sapiDir)) {
    log(`[devkit:watch] 无 sapi 目录: ${sapiDir}`);
    return { stop: () => {} };
  }

  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let pending = new Set<string>();
  let running = false;
  let stopped = false;

  log(`[devkit:watch] 监听 ${opts.moduleRoot}`);

  const runOnce = async () => {
    if (running || stopped) return;
    running = true;
    const changed = [...pending];
    pending = new Set();
    const t0 = Date.now();
    log(`[devkit:watch] rebuild (${changed.length})…`);
    try {
      const r = await opts.onRebuild();
      const ms = Date.now() - t0;
      if (r.ok) log(`[devkit:watch] ok ${ms}ms`);
      else log(`[devkit:watch] fail ${ms}ms ${r.message ?? ""}`);
    } catch (e) {
      log(`[devkit:watch] error ${(e as Error).message}`);
    } finally {
      running = false;
    }
  };

  const onSrc = (rel: string) => {
    if (stopped) return;
    if (rel.includes("node_modules") || rel.includes("dist") || rel.endsWith(".tgz")) return;
    pending.add(rel);
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => void runOnce(), debounceMs);
  };

  const watchers: fs.FSWatcher[] = [];
  if (fs.existsSync(srcDir)) {
    try {
      watchers.push(
        fs.watch(srcDir, { recursive: true, persistent: true }, (_e, filename) => {
          if (filename) onSrc(filename.toString());
        })
      );
    } catch {
      watchers.push(
        fs.watch(srcDir, { persistent: true }, (_e, filename) => {
          if (filename) onSrc(filename.toString());
        })
      );
    }
  }

  const watchMeta = (file: string, kind: string) => {
    if (!fs.existsSync(file)) return;
    watchers.push(
      fs.watch(file, { persistent: true }, (event) => {
        if (event === "change") log(`[devkit:watch] ${kind} 已改，需重启 BDS（SAPI 启动期缓存）`);
      })
    );
  };
  watchMeta(path.join(sapiDir, "manifest.json"), "manifest");
  watchMeta(path.join(sapiDir, "tsconfig.json"), "tsconfig");

  return {
    stop() {
      stopped = true;
      if (debounceTimer) clearTimeout(debounceTimer);
      for (const w of watchers) {
        try {
          w.close();
        } catch {
          /* ignore */
        }
      }
      log("[devkit:watch] stopped");
    },
  };
}
