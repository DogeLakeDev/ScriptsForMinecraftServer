import { randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { createServer } from "node:http";
import fs from "node:fs";
import path from "node:path";
import { WebSocket, WebSocketServer } from "ws";
const serviceNames = new Set(["bds", "db", "qq", "llbot"]);
const port = Number(process.env.REMOTE_PORT ?? 3100);
const host = process.env.REMOTE_HOST ?? "127.0.0.1";
const enrollmentToken = process.env.REMOTE_ENROLL_TOKEN ?? "";
const adminToken = process.env.REMOTE_ADMIN_TOKEN ?? "";
const stateFile = path.resolve(process.env.REMOTE_STATE_FILE ?? "data/remote-controller.json");
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
    return value === "status" || value === "start" || value === "stop" || value === "restart";
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
        socket.send(JSON.stringify({ type: "task", taskId: task.id, action: task.action, ...(task.service ? { service: task.service } : {}) }));
        changed = true;
    }
    if (changed)
        saveState();
}
const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
    try {
        if (req.method === "POST" && url.pathname === "/v1/enroll") {
            if (!enrollmentToken || !authorized(req, enrollmentToken))
                return json(res, 401, { error: "unauthorized" });
            const input = await body(req);
            const id = randomUUID();
            const secret = randomBytes(32).toString("base64url");
            state.agents[id] = { id, secret, name: String(input.name ?? "sfmc-agent"), createdAt: new Date().toISOString() };
            saveState();
            return json(res, 201, { agentId: id, agentSecret: secret });
        }
        if (!adminToken || !authorized(req, adminToken))
            return json(res, 401, { error: "unauthorized" });
        if (req.method === "GET" && url.pathname === "/v1/agents") {
            const agents = Object.values(state.agents).map(({ secret: _secret, ...agent }) => ({ ...agent, connected: connected.has(agent.id) }));
            return json(res, 200, { agents });
        }
        const taskMatch = url.pathname.match(/^\/v1\/agents\/([^/]+)\/tasks$/);
        if (req.method === "POST" && taskMatch?.[1]) {
            const agentId = taskMatch[1];
            if (!state.agents[agentId])
                return json(res, 404, { error: "agent_not_found" });
            const input = await body(req);
            if (!validAction(input.action))
                return json(res, 400, { error: "invalid_action" });
            if (input.action !== "status" && typeof input.service !== "string")
                return json(res, 400, { error: "service_required" });
            if (typeof input.service === "string" && !serviceNames.has(input.service))
                return json(res, 400, { error: "invalid_service" });
            const task = {
                id: randomUUID(),
                agentId,
                action: input.action,
                ...(typeof input.service === "string" ? { service: input.service } : {}),
                status: "queued",
            };
            state.tasks[task.id] = task;
            const socket = connected.get(agentId);
            if (socket?.readyState === WebSocket.OPEN) {
                task.status = "running";
                socket.send(JSON.stringify({ type: "task", taskId: task.id, action: task.action, ...(task.service ? { service: task.service } : {}) }));
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
wss.on("connection", (socket, req, agentId) => {
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
            if (message.type !== "task_result" || !message.taskId)
                return;
            const task = state.tasks[message.taskId];
            if (!task || task.agentId !== agentId)
                return;
            task.status = message.ok ? "complete" : "failed";
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
server.listen(port, host, () => console.log(`remote-controller listening on http://${host}:${port}`));
