# config

```ts
import { config } from "@sfmc-bds/sdk/sapi/config";

interface LandConfig {
  max_lands: number;
}

const cfg = await config.get<LandConfig>("land");
await config.set("land", "max_lands", 5);
config.onChange("land", (key, value) => { /* 进程内回调 */ });
```

## configKey

与 manifest 的 `configKey` 一致，对应 `configs/<key>.json`。

## 行为

- 首次 `get` 会从 db-server 拉整份 JSON 并缓存
- `set` 更新内存并 `POST .../configKey/set`
- `onChange` 仅当前 SAPI 进程内有效，不是 SSE

改配置文件后需重启 BDS 才能从磁盘重新加载；运行中用 `set` 可即时写回。

HTTP 见 [配置 API](../config.md)。
