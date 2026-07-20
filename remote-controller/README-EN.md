# remote-controller

Outbound-only remote management for `sfmc` supervisors. The controller is a tiny HTTP + WebSocket server; each `sfmc` process enrolls once and exposes its `start / stop / restart / status / send` actions across the network. All traffic is **client-initiated** — the supervisor never opens an inbound port.

## When to use it

- Centrally manage several SFMC installations from one place.
- Trigger `status` / `restart` on a remote `bds` from CI, an admin panel, or a chat bot.
- Read recent tasks for an audit trail.

## Quick start

```bash
# 1. controller side — generate two tokens and start
ENROLL=$(node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))")
ADMIN=$(node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))")
REMOTE_ENROLL_TOKEN="$ENROLL" REMOTE_ADMIN_TOKEN="$ADMIN" \
  node remote-controller/dist/index.js
# → listening on http://127.0.0.1:3100

# 2. on each managed host, enroll once (writes configs/remote.json)
node sfmc/dist/sfmc.js remote enroll http://controller.local:3100 "$ENROLL" host-a
# prints "Enrolled remote agent: <uuid>" and stays alive; Ctrl-C exits cleanly.

# 3. dispatch from anywhere with the admin token
curl -sS -X POST \
  -H "Authorization: Bearer $ADMIN" \
  -H 'content-type: application/json' \
  -d '{"action":"status"}' \
  http://controller.local:3100/v1/agents/<uuid>/tasks
# → 202 { id, status: "queued" | "running", ... }
```

Inside an SFMC REPL:

```
sfmc> remote status        # show enrollment + live connection state
sfmc> remote disable       # close connection, keep config on disk
```

## Environment variables

| Var | Default | Required | Purpose |
|---|---|---|---|
| `REMOTE_PORT` | `3100` | no | TCP port to listen on |
| `REMOTE_HOST` | `127.0.0.1` | no | Bind address. Set to `0.0.0.0` to expose on the network (use a reverse proxy for TLS) |
| `REMOTE_ENROLL_TOKEN` | — | **yes** | Bearer token required for `POST /v1/enroll`. Treat as a one-time-use secret; rotate by changing the env var + redeploying controller |
| `REMOTE_ADMIN_TOKEN` | — | **yes** | Bearer token for all admin endpoints. Rotate independently |
| `REMOTE_STATE_FILE` | `data/remote-controller.json` | no | Persistent agent registry + task log |
| `REMOTE_HEARTBEAT_MS` | `25000` | no | WS heartbeat interval; client pings every 20s |

Both tokens are mandatory — the process exits non-zero on startup if either is missing.

## HTTP API

All admin routes require `Authorization: Bearer <REMOTE_ADMIN_TOKEN>`.

| Method | Path | Auth | Notes |
|---|---|---|---|
| `GET` | `/v1/health` | — | Returns `{ ok, agents, connected }`. Open, no token |
| `POST` | `/v1/enroll` | enroll token | Body `{ name?: string }`. Returns `{ agentId, agentSecret }` — write to `configs/remote.json` on the host |
| `GET` | `/v1/agents` | admin token | List all agents with `connected` flag |
| `GET` | `/v1/agents/{id}` | admin token | Single agent detail (incl. `lastSeenAt`) |
| `DELETE` | `/v1/agents/{id}` | admin token | Removes the agent and closes its WS connection. In-flight tasks are marked `failed` with `agent_deleted` |
| `POST` | `/v1/agents/{id}/tasks` | admin token | Dispatch a task (see below) |
| `GET` | `/v1/agents/{id}/tasks` | admin token | List tasks for an agent. Optional `?status=complete\|failed\|running\|queued`, `?limit=50` (max 200) |
| `GET` | `/v1/tasks/{id}` | admin token | Inspect a single task |
| `WS` | `/v1/agent?id={agentId}` | per-agent secret (in hello frame) | Long-lived connection — used by `sfmc` |

### Tasks

```jsonc
// POST /v1/agents/{id}/tasks
{ "action": "status" }                                      // list services
{ "action": "start",  "service": "bds" }                    // require service
{ "action": "stop",   "service": "db" }
{ "action": "restart","service": "qq" }
{ "action": "send",   "service": "bds", "message": "stop" }  // write to stdin
```

`service` must be one of `bds`, `db`, `qq`, `llbot`. `send` additionally requires a non-empty `message`.

Lifecycle: `queued → running → complete | failed`. The server returns the task immediately with HTTP 202. Poll `GET /v1/tasks/{id}` (or `GET /v1/agents/{id}/tasks?status=...`) to observe the result.

## Agent configuration

After a successful enroll, the supervisor writes `<root>/configs/remote.json`:

```jsonc
{
  "enabled": true,
  "controller_url": "http://controller.local:3100",
  "agent_id": "9e5c...",
  "agent_secret": "fJQK..."
}
```

To disable without deleting: edit `enabled` to `false`, or run `sfmc remote disable` (also clears in-memory state). Delete the file to remove all traces.

## Operational notes

- The controller's `state` file is rewritten synchronously on every change. Don't share it across multiple controller instances — write contention will corrupt it. For HA, run a single controller behind a load balancer and forward WS upgrades.
- The agent reconnects with exponential backoff (1s → 30s) and resets the delay after every disconnect. Heartbeat is 20s from the client, 25s from the server.
- `agent_secret` is the only credential the agent keeps. Treat the file as sensitive (`chmod 600` on POSIX).
- For internet exposure: terminate TLS at a reverse proxy (Caddy, nginx, Cloudflare Tunnel) and bind `REMOTE_HOST=127.0.0.1`. This server does not implement rate limiting, IP allow-lists, or Origin checks.

## Development

```bash
# build
npx tsc -p tsconfig.json

# run from source (no build)
REMOTE_ENROLL_TOKEN=t1 REMOTE_ADMIN_TOKEN=t2 npx tsx src/index.ts

# smoke test (enroll + dispatch + delete, no sfmc required)
node tools/smoke-remote-controller.js
```

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| Process exits with "missing required env vars" | Set both `REMOTE_ENROLL_TOKEN` and `REMOTE_ADMIN_TOKEN` |
| `401 unauthorized` from `/v1/enroll` | Wrong enroll token, or token has trailing whitespace |
| Agent never connects | Check `configs/remote.json` has all four fields; controller reachable from the agent host; WS upgrade not blocked by a proxy |
| Tasks stuck in `queued` | Agent not connected; check `GET /v1/agents/{id}` → `connected: false` |
| `invalid_service` | Service name must be lowercase: `bds`, `db`, `qq`, `llbot` |