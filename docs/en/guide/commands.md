# Command reference

Type `help` in the console for commands available in your environment. Below is a category cheat sheet; `mod` ≡ `module`, `addon` ≡ `packs`.

## Services

| Command | Purpose |
| ------ | ------ |
| `status` | Running state |
| `start db\|qq\|llbot\|bds\|-all` | Start |
| `stop …` / `restart …` | Stop / restart |
| `logs <svc> [-n N] [-f]` | Logs (REPL; `Ctrl+L` for in-memory view) |
| `send <svc> <…>` | Send input to a service process (REPL only) |
| `init` | Setup wizard (TTY required) |
| `update [--check-only]` | BDS update |

## Modules

| Command | Purpose |
| ------ | ------ |
| `mod list` / `mod info <id>` | List / details |
| `mod search` | Search registry |
| `mod install <id>…` | Install |
| `mod uninstall <id>…` | Uninstall |
| `mod enable \| disable <id>` | Enable/disable (writes lock; hot-sync when db online) |
| `mod verify` | Validate |
| `mod build` | Build behavior pack only |
| `mod reload [--build-only]` | Build, deploy, optionally request BDS reload |

Author test / Watch / publish: [Module authoring](../dev/module-author.md) (VS Code **SFMC Module** extension). `mod test|watch|publish` are not provided at the top level.

Top-level shortcuts: `install` / `uninstall` / `search` / `verify` ≡ `mod …`.

## Add-ons

| Command | Purpose |
| ------ | ------ |
| `packs list` / `packs search <q>` | List / CurseForge search |
| `packs install` / `packs scan` | Install / scan inbox |
| `packs enable \| disable <id>` | Enable/disable |
| `packs uninstall [id…] [--purge]` | Uninstall |
| `packs bind` / `unbind` / `sources` | Update sources |
| `packs check` / `packs update` | Check / apply updates |
| `packs bump <id>` | Bump RP version |
| `packs doctor` / `packs path` | Diagnose / paths |

## General

| Command | Purpose |
| ------ | ------ |
| `locale` | UI language |
| `version` | Version |
| `help` | Help |
| `quit` | Exit REPL |
| `debug …` | Debug (development) |

More detail: [Service management](./services.md), [Modules](./modules.md), [Add-ons](./addons.md).
