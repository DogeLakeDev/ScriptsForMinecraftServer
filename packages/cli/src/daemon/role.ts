/**
 * role.ts — 标识当前进程是守护进程服务端还是 CLI 客户端
 *
 * 使用场景：commands / services 在导出入口处分流——守护进程内直接操作
 * Service 子进程；CLI 进程则经本机管道 RPC 转发到守护进程。
 */

/** 进程角色：cli 为默认客户端；daemon 为持有监管权的服务端 */
export type DaemonRole = "cli" | "daemon";

let role: DaemonRole = "cli";

/** 将当前进程标记为守护进程服务端（仅 `--daemon` 入口调用一次） */
export function markDaemonServer(): void {
  role = "daemon";
}

/** 当前是否为守护进程服务端（持有 ChildProcess 与自动重启定时器） */
export function isDaemonServer(): boolean {
  return role === "daemon";
}
