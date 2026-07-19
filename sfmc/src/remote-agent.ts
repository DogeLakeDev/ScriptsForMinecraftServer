import fs from "node:fs";
import path from "node:path";
import { WebSocket } from "ws";
import { configPath } from "@sfmc/config";
import { cmdRestart, cmdStart, cmdStop } from "./commands.js";
import { ROOT } from "./runtime.js";
import { SERVICE_NAMES, serviceStatus, type ServiceName } from "./services.js";

type RemoteConfig = {
  enabled?: boolean;
  controller_url?: string;
  agent_id?: string;
  agent_secret?: string;
};

type Task = {
  type: "task";
  taskId: string;
  action: "status" | "start" | "stop" | "restart";
  service?: string;
};

let socket: WebSocket | null = null;
let retryTimer: NodeJS.Timeout | null = null;
let retryDelay = 1000;

function loadConfig(): RemoteConfig {
  try {
    return JSON.parse(fs.readFileSync(configPath(ROOT, "remote.json"), "utf-8")) as RemoteConfig;
  } catch {
    return {};
  }
}

function writeConfig(config: RemoteConfig): void {
  const file = configPath(ROOT, "remote.json");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(config, null, 2)}\n`, "utf-8");
}

function isService(value: string | undefined): value is ServiceName {
  return !!value && SERVICE_NAMES.includes(value as ServiceName);
}

function isAction(value: unknown): value is Task["action"] {
  return value === "status" || value === "start" || value === "stop" || value === "restart";
}

function websocketUrl(controllerUrl: string, agentId: string): string {
  const url = new URL(controllerUrl);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.pathname = "/v1/agent";
  url.search = new URLSearchParams({ id: agentId }).toString();
  return url.toString();
}

function send(payload: unknown): void {
  if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(payload));
}

async function execute(task: Task): Promise<unknown> {
  if (!isAction(task.action)) throw new Error("invalid task action");
  if (task.action === "status") return { services: serviceStatus() };
  if (!isService(task.service)) throw new Error("service is required and must be one of: " + SERVICE_NAMES.join(", "));

  const output =
    task.action === "start"
      ? await cmdStart(task.service)
      : task.action === "stop"
        ? await cmdStop(task.service)
        : await cmdRestart(task.service);
  return { output, services: serviceStatus() };
}

function scheduleReconnect(): void {
  if (retryTimer) return;
  retryTimer = setTimeout(() => {
    retryTimer = null;
    startRemoteAgent();
  }, retryDelay);
  retryDelay = Math.min(retryDelay * 2, 30_000);
}

/** Start one outbound-only remote-management connection for this supervisor process. */
export function startRemoteAgent(): void {
  if (socket || retryTimer) return;
  const config = loadConfig();
  if (!config.enabled || !config.controller_url || !config.agent_id || !config.agent_secret) return;

  try {
    socket = new WebSocket(websocketUrl(config.controller_url, config.agent_id));
  } catch {
    socket = null;
    scheduleReconnect();
    return;
  }

  socket.on("open", () => {
    retryDelay = 1000;
    send({ type: "hello", agentId: config.agent_id, secret: config.agent_secret, status: serviceStatus() });
  });
  socket.on("message", (raw) => {
    let task: Task;
    try {
      task = JSON.parse(raw.toString()) as Task;
    } catch {
      return;
    }
    if (task.type !== "task") return;
    void execute(task)
      .then((result) => send({ type: "task_result", taskId: task.taskId, ok: true, result }))
      .catch((error: Error) => send({ type: "task_result", taskId: task.taskId, ok: false, error: error.message }));
  });
  socket.on("close", () => {
    socket = null;
    scheduleReconnect();
  });
  socket.on("error", () => {
    /* close schedules reconnect */
  });
}

export async function enrollRemoteAgent(controllerUrl: string, enrollmentToken: string, name: string): Promise<string> {
  const response = await fetch(new URL("/v1/enroll", controllerUrl), {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${enrollmentToken}` },
    body: JSON.stringify({ name }),
  });
  const result = (await response.json()) as { agentId?: string; agentSecret?: string; error?: string };
  if (!response.ok || !result.agentId || !result.agentSecret) throw new Error(result.error ?? "enrollment failed");

  writeConfig({ enabled: true, controller_url: controllerUrl, agent_id: result.agentId, agent_secret: result.agentSecret });
  return result.agentId;
}

export function remoteStatus(): Omit<RemoteConfig, "agent_secret"> {
  const config = loadConfig();
  return {
    ...(config.enabled !== undefined ? { enabled: config.enabled } : {}),
    ...(config.controller_url ? { controller_url: config.controller_url } : {}),
    ...(config.agent_id ? { agent_id: config.agent_id } : {}),
  };
}
