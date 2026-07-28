/**
 * sfmc/src/module-watch.ts — `sfmc mod watch` 引擎
 *
 * 监听 cwd/local 模块的 sapi/src 变更 → 复用 cmdModuleReload 的 build/deploy/reload
 * 路径，避免在核心 switch/if 链上再打洞（OCP/DRY）。
 *
 * 触发语义：
 *   - sapi/src/** 变更 → rebuild + deploy + reload
 *   - sapi/manifest.json 变更 → 仅提示「SAPI 启动期缓存，请重启 BDS 进程」，不自动热更
 *   - sapi/tsconfig.json 变更 → 同 manifest，提示重启
 *   - 其他（configs/、SDK 内部、node_modules、dist、*.tgz）→ 忽略
 *
 * 进程探测复用 sfmc-cli 统一接口：queryServicesRuntime + probeBdsStatus；
 * 外部 BDS（state === "external"）降级 build+deploy 并提示「请在 BDS/游戏内输入 reload」。
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { c } from "./theme.js";
import { t } from "./i18n/index.js";

/** watch 监听配置。 */
export interface WatchOptions {
  /** 模块仓根（cwd/local 解析出的目录，含 sapi/）。 */
  moduleRoot: string;
  /** 只 build+deploy，不向 BDS 发 reload。 */
  noReload: boolean;
  /** 防抖毫秒数。 */
  debounceMs: number;
  /** 终端打印回调（被 watch 命令自己接住；这里仅做轻 wrap）。 */
  log: (line: string) => void;
}

/** 一次 build+deploy(+reload) 周期。 */
export interface WatchRunResult {
  ok: boolean;
  rebuilt: boolean;
  reloadSent: boolean;
  /** 若被提示「请重启」则为 true。 */
  warnedRestart: boolean;
  message: string;
}

/** 解析 `--from local[:path]` 规则（与 mod install 一致；本轮复用 watch 单一路径）。 */
export function resolveLocalModuleRoot(args: { from?: string | null; cwd: string }): string {
  const raw = (args.from ?? "").trim();
  if (!raw) return path.resolve(args.cwd);
  /* `--from local[:<path>]` */
  if (raw === "local") return path.resolve(args.cwd);
  if (raw.startsWith("local:")) {
    const p = raw.slice("local:".length).trim();
    if (!p) return path.resolve(args.cwd);
    return path.isAbsolute(p) ? path.resolve(p) : path.resolve(args.cwd, p);
  }
  /* `--from dir:<path>` 兼容旧写法（暂不强制；本期 watch 不强制链接 dir）。 */
  if (raw.startsWith("dir:")) {
    const p = raw.slice("dir:".length).trim();
    return path.isAbsolute(p) ? path.resolve(p) : path.resolve(args.cwd, p);
  }
  return path.resolve(args.cwd);
}

/** 启动 chokidar 风格的 fs.watch；本轮直接用 node:fs.watch（轻量、零依赖）。 */
export function startWatch(opts: WatchOptions): { stop: () => void } {
  const sapiDir = path.join(opts.moduleRoot, "sapi");
  if (!fs.existsSync(sapiDir)) {
    opts.log(c.red(t("watch.noSapiDir", { path: sapiDir })));
    return { stop: () => {} };
  }
  const srcDir = path.join(sapiDir, "src");
  if (!fs.existsSync(srcDir)) {
    opts.log(c.yellow(t("watch.noSapiSrc", { path: srcDir })));
  }

  let debounceTimer: NodeJS.Timeout | null = null;
  let pending: Set<string> = new Set();
  let running = false;
  let stopped = false;

  /* 启动 banner */
  opts.log(c.bold(t("watch.banner", { path: opts.moduleRoot })));
  opts.log(c.dim(t("watch.hint")));

  const trigger = (kind: "src" | "manifest" | "tsconfig", files: string[]) => {
    if (stopped) return;
    if (kind === "manifest" || kind === "tsconfig") {
      opts.log(c.yellow(t("watch.manifestOrTsconfig", { kind, files: files.join(", ") })));
      return;
    }
    /* src 变更：合并到 pending，等待 debounce 触发一次 rebuild。 */
    for (const f of files) pending.add(f);
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      void runOnce();
    }, opts.debounceMs);
  };

  const runOnce = async (): Promise<void> => {
    if (running || stopped) return;
    running = true;
    const changed = [...pending];
    pending = new Set();
    const t0 = Date.now();
    opts.log(c.dim(t("watch.rebuild.start", { count: changed.length, files: changed.join(", ") })));
    try {
      const { cmdModuleReload } = await import("./module-pack-build.js");
      const out = await cmdModuleReload(opts.noReload ? ["--build-only"] : []);
      const ok = !out.startsWith(c.red(""));
      const elapsed = Date.now() - t0;
      if (ok) {
        opts.log(c.green(t("watch.rebuild.ok", { ms: elapsed })));
        if (!opts.noReload) {
          opts.log(c.green(t("watch.reload.sent")));
        } else {
          opts.log(c.yellow(t("watch.reload.manualHint")));
        }
      } else {
        opts.log(c.red(t("watch.rebuild.fail", { ms: elapsed, output: out.trim() })));
      }
    } catch (e) {
      opts.log(c.red(t("watch.rebuild.error", { message: (e as Error).message })));
    } finally {
      running = false;
    }
  };

  /**
   * 一次性 runOnce + send reload，兼容 `sfmc mod test`/wizard 未来复用：
   * 本期不导出，但保留扩展位。
   */
  void runOnce;

  /* 监听 sapi/src 树。 */
  const watchSrc = (dir: string): fs.FSWatcher | null => {
    if (!fs.existsSync(dir)) return null;
    try {
      return fs.watch(
        dir,
        { recursive: true, persistent: true },
        (_event, filename) => {
          if (!filename) return;
          const rel = filename.toString();
          /* 过滤：dist / *.tgz / 临时文件 */
          if (rel.includes("node_modules") || rel.includes("dist") || rel.endsWith(".tgz")) return;
          trigger("src", [rel]);
        }
      );
    } catch (e) {
      /* Windows 某些长路径/权限场景下 recursive 不支持；降级到非 recursive。 */
      opts.log(c.yellow(t("watch.recursiveFallback", { message: (e as Error).message })));
      return fs.watch(dir, { persistent: true }, (_event, filename) => {
        if (!filename) return;
        trigger("src", [filename.toString()]);
      });
    }
  };

  /* 监听 manifest / tsconfig：单独 watcher，不触发 build。 */
  const watchMeta = (file: string, kind: "manifest" | "tsconfig"): fs.FSWatcher | null => {
    if (!fs.existsSync(file)) return null;
    return fs.watch(file, { persistent: true }, (event) => {
      if (event === "change") trigger(kind, [path.basename(file)]);
    });
  };

  const watchers: fs.FSWatcher[] = [];
  const ws = watchSrc(srcDir);
  if (ws) watchers.push(ws);
  const wm = watchMeta(path.join(sapiDir, "manifest.json"), "manifest");
  if (wm) watchers.push(wm);
  const wt = watchMeta(path.join(sapiDir, "tsconfig.json"), "tsconfig");
  if (wt) watchers.push(wt);

  const stop = (): void => {
    stopped = true;
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
    for (const w of watchers) {
      try {
        w.close();
      } catch {
        /* ignore */
      }
    }
    opts.log(c.dim(t("watch.stopped")));
  };

  return { stop };
}

/** CLI 入口：`sfmc mod watch [--from local[:path]] [--no-reload]` */
export async function cmdModuleWatch(args: string[]): Promise<string> {
  let fromRaw: string | null = null;
  let noReload = false;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--from") {
      fromRaw = args[++i] ?? null;
    } else if (a?.startsWith("--from=")) {
      fromRaw = a.slice("--from=".length);
    } else if (a === "--no-reload") {
      noReload = true;
    } else if (a === "--help" || a === "-h") {
      return c.dim(t("watch.usage"));
    }
  }
  const moduleRoot = resolveLocalModuleRoot({ from: fromRaw, cwd: process.cwd() });

  /* 集中到 stdout：命令行场景下不需要 sfmc 日志管道的 stamp。 */
  const log = (line: string): void => {
    process.stdout.write(line + "\n");
  };

  /* Ctrl+C → stop watchers，再退出。 */
  let stopRef: (() => void) | null = null;
  const onSig = (): void => {
    if (stopRef) stopRef();
    process.exit(0);
  };
  process.once("SIGINT", onSig);
  process.once("SIGTERM", onSig);

  const { stop } = startWatch({
    moduleRoot,
    noReload,
    debounceMs: 200,
    log,
  });
  stopRef = stop;

  /* 保持进程不退出：用一个永驻 Promise。 */
  await new Promise<void>(() => {
    /* never resolves; SIGINT/SIGTERM 触发 exit。 */
  });
  return "";
}
