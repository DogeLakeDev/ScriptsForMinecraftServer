/**
 * service-guard.ts — 网关启动时确保它依赖的实例服务在运行
 *
 * 使用场景：服务器重启后网关由开机任务拉起，但实例服务（尤其 db-server）没有开机自启；
 * 此时 /health 正常，而玩家登录与管理鉴权都要查 db-server，全部失败。
 * main.ts 启动网关后调用 startServiceGuard：经管理通道查询 services.list，未运行的服务用 services.start 拉起
 * （守护进程不在时，管理通道握手会先把它拉起），再轮询确认已经运行。
 * 只在网关启动时执行，成功一次即结束；之后管理员手动停止服务，网关不会再次拉起。
 * 失败（守护进程未就绪、维护锁占用等）按退避间隔重试，直到成功或网关退出。
 */
import { Duplex, Readable, Writable } from "node:stream";
import type { ServiceStatusRow } from "@sfmc-bds/management";
import { ManagementClient } from "@sfmc-bds/management/node";
import { EXIT_GRACE_MS, spawnManageProcess } from "./cli-process.js";
import type { GatewayConfig } from "./config.js";

/**
 * 守卫所需的最小服务控制能力。
 * 使用场景：生产环境由 openCliServiceControl 经 `manage --stdio` 实现；测试用内存实现替换。
 */
export interface ServiceControl {
  /** 当前全部受管服务的运行状态 */
  list(): Promise<ServiceStatusRow[]>;
  /** 提交启动请求；守护进程后台执行，是否成功由调用方再次 list 确认 */
  start(name: string): Promise<void>;
  /** 结束这条控制连接，不影响守护进程与服务 */
  close(): void;
}

/** 守卫的可调参数，测试里缩短等待 */
export interface ServiceGuardOptions {
  /** 需要保证运行的服务名，按启动顺序排列 */
  names: readonly string[];
  /** 打开一条控制连接 */
  open: () => Promise<ServiceControl>;
  log: (message: string) => void;
  /** 首次失败后的重试间隔，之后每次翻倍 */
  retryBaseMs?: number;
  /** 重试间隔上限 */
  retryMaxMs?: number;
  /** 提交启动后等待服务进入运行状态的上限 */
  startTimeoutMs?: number;
  /** 等待期间查询状态的间隔 */
  pollMs?: number;
}

/** 运行中的守卫；stop 用于网关退出时取消尚未完成的重试 */
export interface ServiceGuard {
  stop(): void;
  /** 守卫结束（成功、无事可做或被停止）时完成 */
  done: Promise<void>;
}

const DEFAULT_RETRY_BASE_MS = 10_000;
const DEFAULT_RETRY_MAX_MS = 5 * 60_000;
/** BDS 等服务启动较慢，留足时间再判定失败 */
const DEFAULT_START_TIMEOUT_MS = 120_000;
const DEFAULT_POLL_MS = 1_000;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * 经实例 CLI 的管理通道实现 ServiceControl。
 * 使用场景：startServiceGuard 的生产实现；每次尝试新开一个子进程，结束后关闭。
 */
export async function openCliServiceControl(config: Pick<GatewayConfig, "node" | "entry" | "root">): Promise<ServiceControl> {
  const child = spawnManageProcess(config);
  child.stderr.resume();
  const exited = new Promise<never>((_, reject) => {
    child.once("error", reject);
    child.once("exit", (code, signal) => reject(new Error(`管理通道已退出 (${code ?? signal})`)));
  });
  exited.catch(() => {});
  const client = new ManagementClient(Duplex.fromWeb({ readable: Readable.toWeb(child.stdout), writable: Writable.toWeb(child.stdin) }));
  // 与 bridge.ts 相同：先断开让 CLI 自行退出，超时仍在才强制结束
  const close = () => {
    client.disconnect();
    if (child.exitCode !== null || child.signalCode !== null) return;
    child.stdin.end();
    const timer = setTimeout(() => child.kill(), EXIT_GRACE_MS);
    timer.unref();
    child.once("exit", () => clearTimeout(timer));
  };
  try {
    await Promise.race([client.handshake(config.root), exited]);
  } catch (error) {
    close();
    throw error;
  }
  return {
    list: async () => (await Promise.race([client.call("services.list"), exited])).rows,
    start: async (name) => {
      await Promise.race([client.call("services.start", { name }), exited]);
    },
    close,
  };
}

/**
 * 执行一次检查与拉起。
 * 返回本次拉起的服务名；不认识的服务名记一条日志后忽略，避免因配置笔误无限重试。
 */
async function ensureOnce(options: ServiceGuardOptions): Promise<string[]> {
  const control = await options.open();
  try {
    const rows = await control.list();
    const known = options.names.filter((name) => {
      if (rows.some((row) => row.name === name)) return true;
      options.log(`实例没有名为 ${name} 的服务，已忽略`);
      return false;
    });
    const isRunning = (list: ServiceStatusRow[], name: string) => list.some((row) => row.name === name && row.running);
    const missing = known.filter((name) => !isRunning(rows, name));
    for (const name of missing) await control.start(name);
    if (!missing.length) return [];
    const deadline = Date.now() + (options.startTimeoutMs ?? DEFAULT_START_TIMEOUT_MS);
    for (;;) {
      const current = await control.list();
      const pending = missing.filter((name) => !isRunning(current, name));
      if (!pending.length) return missing;
      if (Date.now() > deadline) throw new Error(`等待超时，仍未运行: ${pending.join("、")}`);
      await sleep(options.pollMs ?? DEFAULT_POLL_MS);
    }
  } finally {
    control.close();
  }
}

/**
 * 启动守卫：立即尝试一次，失败则退避重试，成功后结束。
 * 使用场景：main.ts 在网关开始监听后调用；names 为空时直接结束。
 */
export function startServiceGuard(options: ServiceGuardOptions): ServiceGuard {
  let stopped = false;
  let wake: (() => void) | null = null;
  const base = options.retryBaseMs ?? DEFAULT_RETRY_BASE_MS;
  const max = options.retryMaxMs ?? DEFAULT_RETRY_MAX_MS;
  const run = async () => {
    if (!options.names.length) return;
    for (let attempt = 0; !stopped; attempt++) {
      try {
        const started = await ensureOnce(options);
        options.log(started.length ? `已拉起依赖服务: ${started.join("、")}` : `依赖服务已在运行: ${options.names.join("、")}`);
        return;
      } catch (error) {
        if (stopped) return;
        const wait = Math.min(base * 2 ** attempt, max);
        options.log(`拉起依赖服务失败（${error instanceof Error ? error.message : String(error)}），${Math.round(wait / 1000)} 秒后重试`);
        await new Promise<void>((resolve) => {
          const timer = setTimeout(resolve, wait);
          wake = () => {
            clearTimeout(timer);
            resolve();
          };
        });
        wake = null;
      }
    }
  };
  return {
    stop: () => {
      stopped = true;
      wake?.();
    },
    done: run(),
  };
}
