# runtime

```ts
import {
  debug,
  Msg,
  Command,
  Permission,
  MenuNavigator,
  FormStatus,
  ListFormInfo,
  Money,
} from "@sfmc-bds/sdk/sapi/runtime";
```

## debug

```ts
debug.i("LAND", "loaded");
debug.w("LAND", "stale");
debug.e("LAND", "failed");
```

开关见 [平台开发 · SAPI debug](../dev/platform.md)。

## Msg

```ts
Msg.info("提示", player);
Msg.success("成功", player);
Msg.error("失败", player);
Msg.warning("注意", player);
Msg.tips("小贴士", player);
```

签名为 `(msg, player)`。不要用 `player.sendMessage()`（ESLint：`no-player-send-message`）。

## Permission

```ts
Permission.register("land.use", Permission.Any); // 0
Permission.register("land.admin", Permission.OP); // 2
```

等级：Any=0、Member=1、OP=2、Admin=3。

## Command

```ts
Command.register("mycmd", "land.use", (player) => {
  /* … */
}, "说明");
```

玩家输入 `!mycmd`。内部经 moduleGuard，禁用模块会拦截。

## 表单

- `ListFormInfo(string[])` — 首行带 `[*]`
- `MenuNavigator` — 菜单导航
- `FormStatus` — 表单状态

## Money

计分板余额展示与缓存；单位见 `Money.UNIT`。**写账本**请走 [economy client](../modules/economy.md)，不要只改 Money。

## HttpDB

legacy。新代码用 `@sfmc-bds/sdk/sapi/db`。
