# Remote control

Register this machine's SFMC supervisor with an external controller that dispatches tasks (start/stop services, etc.). Still **beta**.

The agent connects **outbound** to the controller; no inbound management port on the host. Credentials live in `configs/remote.json`.

## Enroll

After obtaining an enrollment token from the controller:

```bash
sfmc remote enroll <controller-url> <enrollment-token> [name]
```

If `name` is omitted, the host computer name is used (or `sfmc-agent`). On success, `remote.json` is written (`enabled`, `controller_url`, `agent_id`, `agent_secret`); the shell process can stay as a daemon.

## Status and disconnect

```bash
sfmc> remote status
sfmc> remote disable
```

| Command | Purpose |
| ------ | ------ |
| `remote enroll …` | Register with controller and enable |
| `remote status` | Print enabled / connection / last error, etc. |
| `remote disable` | Clear enabled flag and disconnect |

`disable` does not erase saved id/secret; re-enable via config or enroll again.

## Runtime

When the supervisor starts with a complete config, it opens a WebSocket, sends `hello` and heartbeats, and runs controller `task` payloads. Reconnects automatically on disconnect.

:::tip Note
Missing fields log a hint to run `sfmc remote enroll`. Logs: `<SFMC_ROOT>/.sfmc/logs/`.

:::
