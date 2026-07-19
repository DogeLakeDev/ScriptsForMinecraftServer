import fs from "node:fs";
import path from "node:path";
import { WebSocket } from "ws";
import { configPath } from "@sfmc/config";
import { cmdRestart, cmdStart, cmdStop } from "./commands.js";
import { ROOT } from "./runtime.js";
import { SERVICE_NAMES, serviceStatus } from "./services.js";
let socket = null;
let retryTimer = null;
let retryDelay = 1000;
function loadConfig() {
    try {
        return JSON.parse(fs.readFileSync(configPath(ROOT, "remote.json"), "utf-8"));
    }
    catch {
        return {};
    }
}
function writeConfig(config) {
    const file = configPath(ROOT, "remote.json");
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, `${JSON.stringify(config, null, 2)}\n`, "utf-8");
}
function isService(value) {
    return !!value && SERVICE_NAMES.includes(value);
}
function isAction(value) {
    return value === "status" || value === "start" || value === "stop" || value === "restart";
}
function websocketUrl(controllerUrl, agentId) {
    const url = new URL(controllerUrl);
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    url.pathname = "/v1/agent";
    url.search = new URLSearchParams({ id: agentId }).toString();
    return url.toString();
}
function send(payload) {
    if (socket?.readyState === WebSocket.OPEN)
        socket.send(JSON.stringify(payload));
}
async function execute(task) {
    if (!isAction(task.action))
        throw new Error("invalid task action");
    if (task.action === "status")
        return { services: serviceStatus() };
    if (!isService(task.service))
        throw new Error("service is required and must be one of: " + SERVICE_NAMES.join(", "));
    const output = task.action === "start"
        ? await cmdStart(task.service)
        : task.action === "stop"
            ? await cmdStop(task.service)
            : await cmdRestart(task.service);
    return { output, services: serviceStatus() };
}
function scheduleReconnect() {
    if (retryTimer)
        return;
    retryTimer = setTimeout(() => {
        retryTimer = null;
        startRemoteAgent();
    }, retryDelay);
    retryDelay = Math.min(retryDelay * 2, 30_000);
}
/** Start one outbound-only remote-management connection for this supervisor process. */
export function startRemoteAgent() {
    if (socket || retryTimer)
        return;
    const config = loadConfig();
    if (!config.enabled || !config.controller_url || !config.agent_id || !config.agent_secret)
        return;
    try {
        socket = new WebSocket(websocketUrl(config.controller_url, config.agent_id));
    }
    catch {
        socket = null;
        scheduleReconnect();
        return;
    }
    socket.on("open", () => {
        retryDelay = 1000;
        send({ type: "hello", agentId: config.agent_id, secret: config.agent_secret, status: serviceStatus() });
    });
    socket.on("message", (raw) => {
        let task;
        try {
            task = JSON.parse(raw.toString());
        }
        catch {
            return;
        }
        if (task.type !== "task")
            return;
        void execute(task)
            .then((result) => send({ type: "task_result", taskId: task.taskId, ok: true, result }))
            .catch((error) => send({ type: "task_result", taskId: task.taskId, ok: false, error: error.message }));
    });
    socket.on("close", () => {
        socket = null;
        scheduleReconnect();
    });
    socket.on("error", () => {
        /* close schedules reconnect */
    });
}
export async function enrollRemoteAgent(controllerUrl, enrollmentToken, name) {
    const response = await fetch(new URL("/v1/enroll", controllerUrl), {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${enrollmentToken}` },
        body: JSON.stringify({ name }),
    });
    const result = (await response.json());
    if (!response.ok || !result.agentId || !result.agentSecret)
        throw new Error(result.error ?? "enrollment failed");
    writeConfig({ enabled: true, controller_url: controllerUrl, agent_id: result.agentId, agent_secret: result.agentSecret });
    return result.agentId;
}
export function remoteStatus() {
    const config = loadConfig();
    return {
        ...(config.enabled !== undefined ? { enabled: config.enabled } : {}),
        ...(config.controller_url ? { controller_url: config.controller_url } : {}),
        ...(config.agent_id ? { agent_id: config.agent_id } : {}),
    };
}
//# sourceMappingURL=remote-agent.js.map