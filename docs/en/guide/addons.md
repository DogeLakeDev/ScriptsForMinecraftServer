# Add-ons

Manage third-party **behavior packs / resource packs** (`.zip`, `.mcpack`, `.mcaddon`, etc.) installed into the current world. Aliases: `addon` ≡ `packs`.

```bash
sfmc> packs scan
sfmc> packs list
```

## Inbox

Path: `<SFMC_ROOT>/packs/`

| Content              | Description                                                   |
| -------------------- | ------------------------------------------------------------- |
| Pending files / dirs | Archives or folders with `manifest.json`                      |
| `_done/`             | Source archives after successful install                      |
| `_failed/`           | Unrecognized or failed installs                               |
| `_trash/`            | Uninstall recycle bin (default)                               |
| `_build/`            | Module behavior pack build output (do not install as add-ons) |
| `pack-sources.json`  | CurseForge and other update source bindings                   |

The inbox is scanned before `start bds`; for day-to-day work **prefer manual `packs scan`** so you can handle conflicts and update sources.

```mermaid
flowchart LR
  inbox[packs inbox] --> scan[scan / install]
  scan --> world[world BP / RP dirs]
  world --> enable[write enable manifest]
```

## Common commands

| Command                                                    | Purpose                                      |
| ---------------------------------------------------------- | -------------------------------------------- |
| `packs list [--kind bp\|rp\|all]`                          | List installed packs                         |
| `packs install [path\|--inbox] [--force]`                  | Install path or scan inbox                   |
| `packs scan [--force] [--dry-run]`                         | Scan inbox                                   |
| `packs enable \| disable <id>`                             | id is uuid or folder name                    |
| `packs uninstall [id...] [--purge]`                        | Remove from world; default to recycle bin    |
| `packs doctor [--fix] [--all-experiments] [--experiments]` | Diagnose pack wiring & level.dat experiments |
| `packs path`                                               | Print related paths                          |
| `packs bump <id>`                                          | RP only: patch version +1                    |

Full subcommands: [Command reference](./commands.md).

### World experiments diagnosis & toggles

Many modern Bedrock add-ons (custom block geometry, entity cameras, native scripts, or newer gameplay features) depend on experimental features enabled in `level.dat`. `packs doctor` provides native, safe inspection and configuration for known experiments:

```bash
# Diagnose pack wiring and inspect current world experiments status
sfmc> packs doctor

# Inspect level.dat experiments only
sfmc> packs doctor --experiments

# Fix pack wiring and automatically enable required Beta APIs
sfmc> packs doctor --fix

# Fix pack wiring and enable all known experimental toggles
sfmc> packs doctor --fix --all-experiments

# Enable specific experiments (comma-separated, aliases supported)
sfmc> packs doctor --fix --experiments=upcoming,cameras,voxel,villager,drop3,edu
```

| Experiment                       | NBT Path / Feature                         | Aliases                     | Description                                                        |
| :------------------------------- | :----------------------------------------- | :-------------------------- | :----------------------------------------------------------------- |
| **Beta APIs**                    | `experiments.gametest`                     | `beta`, `gametest`          | Enables scripting beta APIs (`@minecraft/server`, etc.)            |
| **Upcoming Creator Features**    | `experiments.upcoming_creator_features`    | `upcoming`                  | Custom block traits and extended model rotation                    |
| **Experimental Creator Cameras** | `experiments.experimental_creator_cameras` | `cameras`                   | Custom camera perspectives and `/camera` commands                  |
| **Experimental Voxel Shapes**    | `experiments.voxel_shapes`                 | `voxel`                     | Non-cube block collision and face culling                          |
| **Villager Trade Rebalance**     | `experiments.villager_trades_rebalance`    | `villager`, `trades`        | Biome-dependent librarian book trades and minecart updates         |
| **2026 Drop 3 Update**           | `experiments.drop_3_2026`                  | `drop3`, `wilderness_bound` | Dappled forest, cushions, grass beds, etc.                         |
| **Minecraft Education Features** | `educationFeaturesEnabled` (root tag)      | `edu`, `education`          | Chemistry lab table, periodic table elements, and education blocks |

Every modification automatically creates a backup (`level.dat.bak`), recalculates the 8-byte little-endian header length, and commits via atomic file replacement to ensure world safety.

## Install and conflicts

After a successful install, entries are written to `world_behavior_packs.json` / `world_resource_packs.json` (enabled by default). Restart BDS for changes to take effect.

When the target already has the same uuid or formatted folder name:

| Environment                          | Behavior                                              |
| ------------------------------------ | ----------------------------------------------------- |
| Interactive (TTY)                    | Prompt to compare and confirm overwrite               |
| Non-interactive (e.g. `beforeStart`) | No silent overwrite; skip with warning; use `--force` |

Same uuid with a higher semver can be silently overwritten to the original folder name.

## CurseForge updates

Bind installed BPs to CurseForge projects; check or apply updates at start or on demand.

```bash
sfmc> packs search "Slash Blade"
sfmc> packs bind <uuid|folder> slash-blade-addon
sfmc> packs check
sfmc> packs update --all
sfmc> packs sources
```

| Config                     | Purpose                                                  |
| -------------------------- | -------------------------------------------------------- |
| `configs/pack-update.json` | Master switch, API key, check on startup                 |
| `packs/pack-sources.json`  | Per-pack binding; set `enabled: false` or `packs unbind` |

Environment variable `CURSEFORGE_API_KEY` overrides the API key.

:::tip Note
Implementation details (probe scoring, RP bump strategy, providers): [CurseForge add-on updates (technical)](../dev/pack-update.md).

:::

## Uninstall

`packs uninstall`: disable, remove from world directory (or `--purge` to delete), clear bindings and inbox fingerprints; by default also removes paired RP when uninstalling a BP (`--no-paired` to skip).

Source archives under `packs/_done` are kept after uninstall.
