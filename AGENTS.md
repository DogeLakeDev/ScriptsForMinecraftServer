# AGENTS.md — ScriptsForMinecraftServer

## Repo anatomy

Two disjoint components in one repo:

| Path | What | Runtime |
|------|------|---------|
| `scriptsforminecraftserver/` | Minecraft Bedrock behavior pack (SAPI scripts) | Minecraft Bedrock (Script API) |
| `db-server/` | External SQLite HTTP backend | Node.js |

## Plugin entry & init order

`scripts/main.ts` → `scripts/entry.ts` (`AddOnInit.init()`)

Init phases in `entry.ts`:
1. `system.beforeEvents.startup` — register permissions & commands
2. `world.afterEvents.worldLoad` — init modules (AFK, Coop, Chat, Clean, TPS, OnlineTime, CreativeArea, SurvivalArea, InventorySwitcher, LandSystem, ActivityLog, Money, ScoreboardSync, WorldData, HoloEntity)
3. `world.afterEvents.playerSpawn` (initialSpawn) — Peace, Fly, AFK reset
4. `world.afterEvents.playerSpawn` — SpawnProtect
5. `world.beforeEvents.chatSend` — intercept `!` / `！` commands

## Build & deploy

Run everything from `scriptsforminecraftserver/`:

```powershell
npm install        # install dependencies
npm run build      # tsc + esbuild bundle → dist/scripts/main.js
npm run local-deploy  # build + copy to Minecraft dev folder
npm run local-deploy -- --watch  # watch mode
npm run lint       # ESLint (minecraft-linting/avoid-unnecessary-command)
```

`.env` controls deploy target:
- `PROJECT_NAME="ScriptsForMinecraftServer"`
- `MINECRAFT_PRODUCT="Custom"`
- `CUSTOM_DEPLOYMENT_PATH="D:\Minecraft\BEServer\worlds\sptest2(ed)"`

Manual copy script at `copy.bat` (uses a different hardcoded path).

To deploy to production: `just-scripts package` (copies dev→prod, deletes dev copy).

db-server: `cd db-server && node index.js` (default port 3001, override via `DB_PORT`).

## Dependency quirks

- `@minecraft/server` uses `2.10.0-beta.1.26.40-preview.29` — beta SAPI version
- `@minecraft/server-net` needed for HTTP calls to db-server
- `better-sqlite3` in db-server requires native build toolchain
- No test framework in either component

## Key module locations (updated from README tree)

| Module | Actual path |
|--------|-------------|
| Scoreboard sync | `data/Scoreboards.ts` (not `backup/ScoreboardSync.ts`) |
| Activity log | `data/ActivityLog.ts` |
| World data sync | `data/World.ts` |
| Holographic display | `holo/HoloEntity.ts` + `holo/HoloGUI.ts` |
| API wrappers | `api/ActivityLogsApi.ts`, `ChatApi.ts`, `HoloprintApi.ts`, `KVApi.ts`, `PlayersDataApi.ts`, `ScoreboardsSyncApi.ts`, `WorldDataApi.ts` |

## Code conventions

- **Message display**: Use `Msg.info/success/error/warning/tips()` from `libs/Tools.ts` (adds `§f[*]`/`§a[√]`/`§c[x]`/`§e[!]`/`§7[!]` prefix)
- **Form body**: Use `ListFormInfo(string[])` from `gui/` — first line gets `[*]` prefix, indented lines are plain
- **Buttons**: No formatting codes except `§l返回` for back buttons
- **Form titles**: No formatting codes
- **Money**: Scoreboard-based, unit from `Money.UNIT` (`节操`)
- **Commands**: `!<command>` syntax intercepted in `beforeEvents.chatSend`
- **Permissions**: `Permission.register(name, level)` in startup, levels: Any=0, Member=1, OP=2, Admin=3
- **Storage**: `world.setDynamicProperty` for shop, coop, land, invswitcher (being deprecated to db-server SQLite)
- **db-server HTTP**: Via `HttpDB` class in `libs/HttpDB.ts`, targets `Config.dbHost:Config.dbPort`

## Prettier
trailingComma es5, tabWidth 2, semicolons, double quotes, bracketSpacing, arrowParens always, printWidth 120, endOfLine auto.

## Docs&Links
- https://sapi.dogelake.cn/index.html
- https://zh.minecraft.wiki/
- https://mcbeui.pages.dev/
- https://wiki.bedrock.dev/
- https://learn.microsoft.com/zh-cn/minecraft/creator/
- https://holoprint-mc.github.io/
