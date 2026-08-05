/**
 * cmd-remote.ts — remote 子命令调度（main / REPL 共用，避免两处复制）
 */
import { t } from "./i18n/index.js";
import {
  disableRemoteAgent,
  enrollRemoteAgent,
  remoteStatus,
  startRemoteAgent,
  stopRemoteAgent,
} from "./remote-agent.js";

export type CmdRemoteOptions = {
  /**
   * enroll 成功后是否挂起进程（外壳 `sfmc remote enroll` 守护）。
   * REPL 内应为 false，只启动 agent 后返回。
   */
  daemonAfterEnroll?: boolean;
};

/**
 * 执行 remote 子命令；返回要打印的文本。
 * enroll+daemon 时本函数不返回（进程挂起）。
 */
export async function cmdRemote(args: string[], opts: CmdRemoteOptions = {}): Promise<string> {
  const [subcommand, ...remoteArgs] = args;
  if (subcommand === "enroll" && remoteArgs[0] && remoteArgs[1]) {
    const name = remoteArgs[2] ?? process.env.COMPUTERNAME ?? "sfmc-agent";
    const agentId = await enrollRemoteAgent(remoteArgs[0]!, remoteArgs[1]!, name);
    startRemoteAgent();
    if (opts.daemonAfterEnroll) {
      const exit = (): void => {
        stopRemoteAgent();
        process.exit(0);
      };
      process.once("SIGINT", exit);
      process.once("SIGTERM", exit);
      await new Promise(() => undefined);
    }
    return t("remote.enrolled", { id: agentId });
  }
  if (subcommand === "status") {
    return JSON.stringify(remoteStatus(), null, 2);
  }
  if (subcommand === "disable") {
    disableRemoteAgent();
    return t("remote.disabled");
  }
  return t("remote.usage");
}
