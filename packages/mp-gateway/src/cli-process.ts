/**
 * cli-process.ts — 启动实例的 `sfmc manage --stdio` 子进程
 *
 * 使用场景：bridge.ts 为每条管理会话启动一个；service-guard.ts 在网关启动时临时启动一个，检查并拉起依赖服务。
 * 两处共用同一份启动参数，保证连接的实例目录、Node 与 CLI 入口一致。
 */
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import type { GatewayConfig } from "./config.js";

/** 关闭管理通道后等待 CLI 子进程自行退出的时间，超时再强制结束 */
export const EXIT_GRACE_MS = 5_000;

/** 启动管理通道子进程。守护进程不在时，CLI 会在握手阶段把它拉起。 */
export function spawnManageProcess(config: Pick<GatewayConfig, "node" | "entry" | "root">): ChildProcessWithoutNullStreams {
  const { node, entry, root } = config;
  return spawn(node, [entry, "manage", "--stdio"], {
    cwd: root,
    env: { ...process.env, SFMC_ROOT: root, SFMC_NODE_BINARY: node, SFMC_DAEMON_ENTRY: entry },
    windowsHide: true,
    stdio: "pipe",
  });
}
