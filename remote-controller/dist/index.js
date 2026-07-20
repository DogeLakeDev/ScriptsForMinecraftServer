import { randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { createServer } from "node:http";
import fs from "node:fs";
import path from "node:path";
import { WebSocket, WebSocketServer } from "ws";
const serviceNames = new Set(["bds", "db", "qq", "llbot"]);
const actionsRequiringService = new Set(["start", "stop", "restart", "send"]);
const port = Number(process.env.REMOTE_PORT ?? 3100);
const host = process.env.REMOTE_HOST ?? "127.0.0.1";
const enrollmentToken = process.env.REMOTE_ENROLL_TOKEN ?? "";
const adminToken = process.env.REMOTE_ADMIN_TOKEN ?? "";
const stateFile = path.resolve(process.env.REMOTE_STATE_FILE ?? "data/remote-controller.json");
const heartbeatIntervalMs = Number(process.env.REMOTE_HEARTBEAT_MS ?? 25_000);
if (!enrollmentToken || !adminToken) {
    console.error("[remote-controller] missing required env vars.");
    console.error("  set both: REMOTE_ENROLL_TOKEN=<random> and REMOTE_ADMIN_TOKEN=<random>");
    console.error("  example:");
    console.error("    REMOTE_ENROLL_TOKEN=$(node -e \"console.log(require('crypto').randomBytes(24).toString('base64url'))\") \\");
    console.error("    REMOTE_ADMIN_TOKEN=$(node -e \"console.log(require('crypto').randomBytes(24).toString('base64url'))\") \\");
    console.error("    node remote-controller/dist/index.js");
    process.exit(1);
}
const connected = new Map();
function loadState() {
    try {
        return JSON.parse(fs.readFileSync(stateFile, "utf-8"));
    }
    catch {
        return { agents: {}, tasks: {} };
    }
}
let state = loadState();
function saveState() {
    fs.mkdirSync(path.dirname(stateFile), { recursive: true });
    fs.writeFileSync(stateFile, `${JSON.stringify(state, null, 2)}\n`, "utf-8");
}
function json(res, status, body) {
    res.writeHead(status, { "content-type": "application/json" });
    res.end(JSON.stringify(body));
}
async function body(req) {
    let raw = "";
    for await (const chunk of req)
        raw += String(chunk);
    return raw ? JSON.parse(raw) : {};
}
function authorized(req, token) {
    const value = req.headers.authorization?.replace(/^Bearer\s+/i, "") ?? "";
    const actual = Buffer.from(value);
    const expected = Buffer.from(token);
    return actual.length === expected.length && timingSafeEqual(actual, expected);
}
function validAction(value) {
    return value === "status" || value === "start" || value === "stop" || value === "restart" || value === "send";
}
function agentPublic(agent) {
    return { id: agent.id, name: agent.name, createdAt: agent.createdAt, ...(agent.lastSeenAt ? { lastSeenAt: agent.lastSeenAt } : {}), connected: connected.has(agent.id) };
}
function dispatchQueuedTasks(agentId) {
    const socket = connected.get(agentId);
    if (socket?.readyState !== WebSocket.OPEN)
        return;
    let changed = false;
    for (const task of Object.values(state.tasks)) {
        if (task.agentId !== agentId || task.status !== "queued")
            continue;
        task.status = "running";
        const payload = { type: "task", taskId: task.id, action: task.action };
        if (task.service)
            payload.service = task.service;
        if (task.message)
            payload.message = task.message;
        socket.send(JSON.stringify(payload));
        changed = true;
    }
    if (changed)
        saveState();
}
const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
    try {
        if (req.method === "GET" && url.pathname === "/v1/health") {
            return json(res, 200, { ok: true, agents: Object.keys(state.agents).length, connected: connected.size });
        }
        if (req.method === "POST" && url.pathname === "/v1/enroll") {
            if (!authorized(req, enrollmentToken))
                return json(res, 401, { error: "unauthorized" });
            const input = await body(req);
            const id = randomUUID();
            const secret = randomBytes(32).toString("base64url");
            state.agents[id] = { id, secret, name: String(input.name ?? "sfmc-agent"), createdAt: new Date().toISOString() };
            saveState();
            return json(res, 201, { agentId: id, agentSecret: secret });
        }
        if (!authorized(req, adminToken))
            return json(res, 401, { error: "unauthorized" });
        if (req.method === "GET" && url.pathname === "/v1/agents") {
            const agents = Object.values(state.agents).map((a) => agentPublic(a));
            return json(res, 200, { agents });
        }
        const agentMatch = url.pathname.match(/^\/v1\/agents\/([^/]+)$/);
        if (req.method === "GET" && agentMatch?.[1]) {
            const agent = state.agents[agentMatch[1]];
            if (!agent)
                return json(res, 404, { error: "agent_not_found" });
            return json(res, 200, agentPublic(agent));
        }
        if (req.method === "DELETE" && agentMatch?.[1]) {
            const agentId = agentMatch[1];
            const agent = state.agents[agentId];
            if (!agent)
                return json(res, 404, { error: "agent_not_found" });
            const socket = connected.get(agentId);
            if (socket && socket.readyState === WebSocket.OPEN)
                socket.close(1000, "deleted_by_admin");
            connected.delete(agentId);
            delete state.agents[agentId];
            for (const task of Object.values(state.tasks)) {
                if (task.agentId === agentId && (task.status === "queued" || task.status === "running")) {
                    task.status = "failed";
                    task.error = "agent_deleted";
                    task.completedAt = new Date().toISOString();
                }
            }
            saveState();
            return json(res, 204, {});
        }
        const tasksMatch = url.pathname.match(/^\/v1\/agents\/([^/]+)\/tasks$/);
        if (req.method === "GET" && tasksMatch?.[1]) {
            const agentId = tasksMatch[1];
            if (!state.agents[agentId])
                return json(res, 404, { error: "agent_not_found" });
            const statusFilter = url.searchParams.get("status");
            const limit = Math.min(Number(url.searchParams.get("limit") ?? 50), 200);
            const tasks = Object.values(state.tasks)
                .filter((t) => t.agentId === agentId && (!statusFilter || t.status === statusFilter))
                .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
                .slice(0, limit);
            return json(res, 200, { tasks });
        }
        if (req.method === "POST" && tasksMatch?.[1]) {
            const agentId = tasksMatch[1];
            if (!state.agents[agentId])
                return json(res, 404, { error: "agent_not_found" });
            const input = await body(req);
            if (!validAction(input.action))
                return json(res, 400, { error: "invalid_action" });
            if (actionsRequiringService.has(input.action)) {
                if (typeof input.service !== "string")
                    return json(res, 400, { error: "service_required" });
                if (!serviceNames.has(input.service))
                    return json(res, 400, { error: "invalid_service" });
            }
            if (input.action === "send" && (typeof input.message !== "string" || !input.message.length)) {
                return json(res, 400, { error: "message_required" });
            }
            const task = {
                id: randomUUID(),
                agentId,
                action: input.action,
                ...(typeof input.service === "string" ? { service: input.service } : {}),
                ...(typeof input.message === "string" ? { message: input.message } : {}),
                status: "queued",
                createdAt: new Date().toISOString(),
            };
            state.tasks[task.id] = task;
            const socket = connected.get(agentId);
            if (socket?.readyState === WebSocket.OPEN) {
                task.status = "running";
                const payload = { type: "task", taskId: task.id, action: task.action };
                if (task.service)
                    payload.service = task.service;
                if (task.message)
                    payload.message = task.message;
                socket.send(JSON.stringify(payload));
            }
            saveState();
            return json(res, 202, task);
        }
        const getTaskMatch = url.pathname.match(/^\/v1\/tasks\/([^/]+)$/);
        if (req.method === "GET" && getTaskMatch?.[1]) {
            const task = state.tasks[getTaskMatch[1]];
            return task ? json(res, 200, task) : json(res, 404, { error: "task_not_found" });
        }
        return json(res, 404, { error: "not_found" });
    }
    catch (error) {
        return json(res, 400, { error: error.message });
    }
});
const wss = new WebSocketServer({ noServer: true });
const heartbeat = setInterval(() => {
    for (const [agentId, socket] of connected) {
        if (socket.readyState !== WebSocket.OPEN)
            continue;
        if (socket.isAlive === false) {
            socket.terminate();
            connected.delete(agentId);
            continue;
        }
        socket.isAlive = false;
        try {
            socket.ping();
        }
        catch {
            /* ignore */
        }
    }
}, heartbeatIntervalMs);
wss.on("close", () => clearInterval(heartbeat));
wss.on("connection", (socket, req, agentId) => {
    socket.isAlive = true;
    socket.on("pong", () => {
        socket.isAlive = true;
    });
    let authenticated = false;
    socket.once("message", (raw) => {
        try {
            const message = JSON.parse(raw.toString());
            const agent = state.agents[agentId];
            const authRequest = { headers: { authorization: `Bearer ${message.secret ?? ""}` } };
            if (message.type !== "hello" || message.agentId !== agentId || !agent || !authorized(authRequest, agent.secret)) {
                socket.close(1008, "unauthorized");
                return;
            }
            authenticated = true;
            agent.lastSeenAt = new Date().toISOString();
            connected.set(agentId, socket);
            saveState();
            dispatchQueuedTasks(agentId);
        }
        catch {
            socket.close(1008, "invalid_hello");
        }
    });
    socket.on("message", (raw) => {
        if (!authenticated)
            return;
        try {
            const message = JSON.parse(raw.toString());
            if (message.type === "ping")
                return;
            if (message.type !== "task_result" || !message.taskId)
                return;
            const task = state.tasks[message.taskId];
            if (!task || task.agentId !== agentId)
                return;
            task.status = message.ok ? "complete" : "failed";
            task.completedAt = new Date().toISOString();
            if (message.ok)
                task.result = message.result;
            else
                task.error = message.error ?? "task failed";
            saveState();
        }
        catch {
            /* Ignore malformed agent messages. */
        }
    });
    socket.on("close", () => {
        if (connected.get(agentId) === socket)
            connected.delete(agentId);
    });
    void req;
});
server.on("upgrade", (req, socket, head) => {
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
    const agentId = url.pathname === "/v1/agent" ? url.searchParams.get("id") : null;
    if (!agentId || !state.agents[agentId])
        return socket.destroy();
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit("connection", ws, req, agentId));
});
server.listen(port, host, () => {
    console.log(`[remote-controller] listening on http://${host}:${port}`);
    console.log(`[remote-controller] state file: ${stateFile}`);
    console.log(`[remote-controller] endpoints:`);
    console.log(`  POST   /v1/enroll                (enroll token)`);
    console.log(`  GET    /v1/health                (open)`);
    console.log(`  GET    /v1/agents                (admin token)`);
    console.log(`  GET    /v1/agents/{id}           (admin token)`);
    console.log(`  DELETE /v1/agents/{id}           (admin token)`);
    console.log(`  POST   /v1/agents/{id}/tasks     (admin token)`);
    console.log(`  GET    /v1/agents/{id}/tasks     (admin token)`);
    console.log(`  GET    /v1/tasks/{id}            (admin token)`);
    console.log(`  WS     /v1/agent?id={id}         (per-agent secret)`);
    console.log(`[remote-controller] heartbeat: ${heartbeatIntervalMs}ms`);
});
