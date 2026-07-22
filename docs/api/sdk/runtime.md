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

## Msg

```ts
Msg.info("提示", player);
Msg.success("成功", player);
Msg.error("失败", player);
Msg.warning("注意", player);
Msg.tips("小贴士", player);
```

别用 `player.sendMessage()`。

## Permission

```ts
Permission.register("land.use", Permission.Any);   // 0
Permission.register("land.admin", Permission.OP);    // 2
```

等级：Any=0、Member=1、OP=2、Admin=3。

## Command

```ts
Command.register("mycmd", "land.use", (player) => {
  // ...
}, "说明");
```

玩家在游戏里输入 `!mycmd`。内部会检查模块是否启用。

## 表单辅助

- `ListFormInfo(string[])` — 第一行带 `[*]` 前缀
- `MenuNavigator` — 菜单导航
- `FormStatus` — 表单状态枚举

## Money

基于计分板，单位见 `Money.UNIT`（默认「节操」）。经济模块常用。

## HttpDB

legacy，新代码请用 `@sfmc-bds/sdk/sapi/db`。
