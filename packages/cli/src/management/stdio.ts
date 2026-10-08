import readline from "node:readline";
import path from "node:path";
import fs from "node:fs";
import { toManagementError, type ManagementRequest } from "@sfmc-bds/management";

/** 首帧确定实例目录，之后才加载含 ROOT 单例的 CLI 代码。 */
export async function runManagementStdio() {
  const output = process.stdout.write.bind(process.stdout);
  for (const key of ["log", "info", "warn", "error", "debug"] as const) console[key] = (...args: unknown[]) => { process.stderr.write(args.map(value => typeof value === "string" ? value : JSON.stringify(value)).join(" ") + "\n"); };
  const lines = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
  let ready = false;
  let dispose: (() => void) | undefined;
  let forwarding: (() => void) | undefined;
  let legacy = false;
  const pending = new Set<Promise<void>>();
  const processLine = async (line: string) => {
    let request: ManagementRequest = { id: "invalid", method: "invalid" };
    try {
      if (Buffer.byteLength(line) > 4 * 1024 * 1024) throw new Error("管理帧过大");
      request = JSON.parse(line) as ManagementRequest;
      if (!request || typeof request.id !== "string" || request.id.length > 128 || typeof request.method !== "string" || request.method.length > 128) throw new Error("非法管理帧");
      if (!ready) {
        if (request.method !== "handshake") throw new Error("首个请求必须为握手");
        const params = request.params as { root?: unknown } | undefined;
        if (typeof params?.root !== "string" || !path.isAbsolute(params.root) || !fs.statSync(params.root).isDirectory()) throw new Error("需要有效的实例绝对目录");
        process.env.SFMC_ROOT = path.resolve(params.root); ready = true;
      } else if (request.method === "handshake" && (request.params as { root?: string } | undefined)?.root && path.resolve((request.params as { root: string }).root) !== process.env.SFMC_ROOT) {
        throw new Error("一个管理会话只能连接一个实例");
      }
      const client = await import("../daemon/client.js");
      if (!forwarding) forwarding = client.onDaemonManagementEvent(event => output(JSON.stringify(event) + "\n"));
      // 指标和玩家名单读当前磁盘上的代码与数据库。管理通道每次连接都会加载新文件，不必为此重启仍在托管服务的守护进程。
      if (ready && request.method === "metrics.read") {
        const metrics = await import("./metrics-read.js");
        output(JSON.stringify({ type: "res", id: request.id, ok: true, result: await metrics.readRuntimeMetrics(request.params) }) + "\n");
        return;
      }
      if (ready && request.method === "players.list") {
        const backend = await import("./server.js");
        output(JSON.stringify({ type: "res", id: request.id, ok: true, result: await backend.dispatchManagement(request) }) + "\n");
        return;
      }
      if (!legacy) {
        try {
          const result = await client.callDaemon("management", { request });
          if (result.kind !== "management") throw new Error("旧守护进程没有管理入口");
          if (request.method === "events.subscribe" && result.response.ok && !dispose) dispose = await client.ensureDaemonSubscription();
          output(JSON.stringify(result.response) + "\n");
          return;
        } catch (error) {
          if (request.method !== "handshake" || !/unknown method|管理入口/.test(error instanceof Error ? error.message : String(error))) throw error;
          legacy = true;
          try { process.env.SFMC_PLATFORM_VERSION = (JSON.parse(fs.readFileSync(path.join(process.env.SFMC_ROOT!, "node_modules", "@sfmc-bds", "sfmc", "package.json"), "utf8")) as { version: string }).version; } catch { process.env.SFMC_PLATFORM_VERSION = "unknown"; }
        }
      }
      // 旧部署只开放接入规划、状态和持久化任务；升级交给独立维护进程。
      const backend = await import("./server.js");
      let value: unknown;
      if (request.method === "handshake") {
        value = { ...(await backend.dispatchManagement(request) as object), capabilities: ["services", "logs", "operations", "updates"], legacy: true };
      } else if (request.method === "services.list") {
        const result = await client.callDaemon("status");
        if (result.kind !== "status") throw new Error("旧部署无法提供服务状态");
        value = { rows: result.rows };
      } else if (request.method === "attachment.plan" || request.method === "attachment.apply") {
        const status = await client.callDaemon("status");
        if (status.kind !== "status") throw new Error("旧部署无法提供服务状态");
        const running = status.rows.filter(row => row.running).map(row => row.name);
        if (request.method === "attachment.apply" && running.length) throw Object.assign(new Error("旧守护进程缺少可确认的优雅维护接口；请先通过原管理器停止服务，再执行接入升级"), { code: "conflict" });
        const plan = await backend.dispatchManagement(request);
        value = request.method === "attachment.plan" ? { ...plan as object, externalServices: running } : plan;
      } else if (["events.subscribe", "logs.tail", "operations.list", "operations.get", "backups.list"].includes(request.method)) value = await backend.dispatchManagement(request);
      else throw Object.assign(new Error("旧部署需先通过接入流程升级平台，再使用完整管理功能"), { code: "unsupported" });
      output(JSON.stringify({ type: "res", id: request.id, ok: true, result: value }) + "\n");
    } catch (error) { output(JSON.stringify({ type: "res", id: request?.id ?? "invalid", ok: false, error: toManagementError(error) }) + "\n"); }
  };
  lines.on("line", line => {
    if (pending.size >= 64) { process.stderr.write("管理请求积压，关闭当前会话\n"); lines.close(); return; }
    const action = processLine(line).catch(error => { process.stderr.write(String(error) + "\n"); });
    pending.add(action); void action.finally(() => pending.delete(action));
  });
  // 标准输入关闭表示管理端离开。只断开与守护进程的管道，不停止服务。
  await new Promise<void>(resolve => lines.once("close", resolve));
  await Promise.allSettled(pending); dispose?.(); forwarding?.();
  if (ready) (await import("../daemon/client.js")).disconnectDaemonClient();
}
