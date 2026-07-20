import fs from "node:fs";
import path from "node:path";
import { WebSocket } from "ws";
import { configPath } from "@sfmc/config";
import { cmdRestart, cmdSend, cmdStart, cmdStop } from "./commands.js";
import { ROOT } from "./runtime.js";
import { SERVICE_NAMES, serviceStatus } from "./services.js";
let socket = null;
let retryTimer = null;
let retryDelay = 1000;
let heartbeatTimer = null;
let lastError = "";
let warnedMissingConfig = false;
let stopping = false;
const HEARTBEAT_INTERVAL_MS = 20_000;
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
    return value === "status" || value === "start" || value === "stop" || value === "restart" || value === "send";
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
function startHeartbeat() {
    stopHeartbeat();
    heartbeatTimer = setInterval(() => send({ type: "ping" }), HEARTBEAT_INTERVAL_MS);
}
function stopHeartbeat() {
    if (heartbeatTimer) {
        clearInterval(heartbeatTimer);
        heartbeatTimer = null;
    }
}
async function execute(task) {
    if (!isAction(task.action))
        throw new Error("invalid task action");
    if (task.action === "status")
        return { services: serviceStatus() };
    if (!isService(task.service))
        throw new Error("service is required and must be one of: " + SERVICE_NAMES.join(", "));
    if (task.action === "send") {
        if (!task.message)
            throw new Error("message is required for send action");
        return { output: await cmdSend(task.service, task.message), services: serviceStatus() };
    }
    const output = task.action === "start"
        ? await cmdStart(task.service)
        : task.action === "stop"
            ? await cmdStop(task.service)
            : await cmdRestart(task.service);
    return { output, services: serviceStatus() };
}
function scheduleReconnect() {
    if (retryTimer || stopping)
        return;
    const delay = retryDelay;
    retryTimer = setTimeout(() => {
        retryTimer = null;
        startRemoteAgent();
    }, delay);
}
function resetReconnect(reason) {
    retryDelay = 1000;
    if (reason) {
        lastError = reason;
        console.warn(`[remote-agent] ${reason} — will retry in ${retryDelay}ms`);
    }
}
/** Close the active socket (if any) and stop reconnecting. Idempotent. */
export function stopRemoteAgent() {
    stopping = true;
    stopHeartbeat();
    if (retryTimer) {
        clearTimeout(retryTimer);
        retryTimer = null;
    }
    if (socket) {
        try {
            socket.close(1000, "client_shutdown");
        }
        catch {
            /* ignore */
        }
        socket = null;
    }
}
/** Start one outbound-only remote-management connection for this supervisor process. */
export function startRemoteAgent() {
    if (stopping)
        return;
    if (socket || retryTimer)
        return;
    const config = loadConfig();
    if (!config.enabled || !config.controller_url || !config.agent_id || !config.agent_secret) {
        if (!warnedMissingConfig) {
            const missing = [];
            if (!config.enabled)
                missing.push("enabled");
            if (!config.controller_url)
                missing.push("controller_url");
            if (!config.agent_id)
                missing.push("agent_id");
            if (!config.agent_secret)
                missing.push("agent_secret");
            if (missing.length) {
                console.warn(`[remote-agent] disabled — missing remote.json fields: ${missing.join(", ")} (run \`sfmc remote enroll\`)`);
            }
            warnedMissingConfig = true;
        }
        return;
    }
    warnedMissingConfig = true;
    let ws;
    try {
        ws = new WebSocket(websocketUrl(config.controller_url, config.agent_id));
    }
    catch (e) {
        resetReconnect(`failed to construct websocket: ${e.message}`);
        scheduleReconnect();
        return;
    }
    socket = ws;
    ws.on("open", () => {
        retryDelay = 1000;
        lastError = "";
        send({ type: "hello", agentId: config.agent_id, secret: config.agent_secret, status: serviceStatus() });
        startHeartbeat();
    });
    ws.on("message", (raw) => {
        let msg;
        try {
            msg = JSON.parse(raw.toString());
        }
        catch {
            return;
        }
        if (msg.type === "ping") {
            send({ type: "pong" });
            return;
        }
        if (msg.type !== "task")
            return;
        const task = msg;
        void execute(task)
            .then((result) => send({ type: "task_result", taskId: task.taskId, ok: true, result }))
            .catch((error) => send({ type: "task_result", taskId: task.taskId, ok: false, error: error.message }));
    });
    ws.on("close", (code, reason) => {
        if (socket === ws)
            socket = null;
        stopHeartbeat();
        if (stopping)
            return;
        resetReconnect(`disconnected (code=${code} ${reason.toString() || "no_reason"})`);
        scheduleReconnect();
    });
    ws.on("error", (e) => {
        resetReconnect(`socket error: ${e.message}`);
        /* close event will follow and trigger reconnect */
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
/** Disable the remote agent: clear enabled flag and close the connection. */
export function disableRemoteAgent() {
    const config = loadConfig();
    if (config.agent_id || config.agent_secret) {
        writeConfig({ ...config, enabled: false });
    }
    stopRemoteAgent();
    stopping = false;
}
export function remoteStatus() {
    const config = loadConfig();
    const result = { connected: socket?.readyState === WebSocket.OPEN };
    if (config.enabled !== undefined)
        result.enabled = config.enabled;
    if (config.controller_url)
        result.controller_url = config.controller_url;
    if (config.agent_id)
        result.agent_id = config.agent_id;
    if (lastError) {
        result.last_error = lastError;
        result.retry_in_ms = retryDelay;
    }
    return result;
}
//# sourceMappingURL=remote-agent.js.map