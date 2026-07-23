#!/usr/bin/env node
/**
 * pack-manager CLI — thin wrapper around the pack-manager pure functions
 * so spawnService can call it as a sub-process.
 *
 *   node bds-tools/dist/pack-manager.js assemble-bp  --src <dir> --out <dir> --name <name> [--uuid <uuid>] [--module-uuid <uuid>] [--version 1,0,0] [--description "..."] [--icon <png>]
 *   node bds-tools/dist/pack-manager.js assemble-rp  --modules-dir <dir> --out <dir> --name <name> [--uuid <uuid>] [--module-uuid <uuid>] [--version 1,0,0] [--description "..."]
 *   node bds-tools/dist/pack-manager.js deploy        --bds-root <dir> --level <name> --bp-src <dir> [--rp-src <dir>] --bp-name <name> [--rp-name <name>]
 *   node bds-tools/dist/pack-manager.js enable-pack   --worlds-dir <dir> --level <name> --kind behavior|resource --pack-id <uuid> --version 1,0,0
 *   node bds-tools/dist/pack-manager.js disable-pack  --worlds-dir <dir> --level <name> --kind behavior|resource --pack-id <uuid>
 *   node bds-tools/dist/pack-manager.js ensure-permission --bds-root <dir> --pack-id <uuid>
 *   node bds-tools/dist/pack-manager.js read-level    --bds-root <dir>
 *
 * The pure-function API lives in pack-manager.ts. This CLI exists so the
 * SEA-launched child process doesn't have to deal with module resolution —
 * it just gets spawnService-injected SFMC_ROOT, finds its own dist sibling,
 * and reads JSON flags from argv.
 */

import path from "node:path";
import process from "node:process";
import { readLevelName } from "./pack-manager.js";

function die(msg: string, code = 1): never {
  process.stderr.write(`[pack-manager] ${msg}\n`);
  process.exit(code);
}

function parseArgs(argv: string[]): { [k: string]: string | undefined } {
  const out: { [k: string]: string | undefined } = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a && a.startsWith("--")) {
      const key = a.slice(2);
      const next = argv[++i];
      out[key] = next;
    }
  }
  return out;
}

function need(args: { [k: string]: string | undefined }, key: string): string {
  const v = args[key];
  if (!v) die(`--${key} required`);
  return v;
}

function parseVersion(s: string | undefined): [number, number, number] {
  if (!s) return [1, 0, 0];
  const parts = s.split(",").map((x) => Number(x.trim()));
  if (parts.length !== 3 || parts.some((n) => !Number.isInteger(n) || (n as number) < 0)) {
    die(`invalid --version (expected "M,m,p"): ${s}`);
  }
  return parts as [number, number, number];
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  if (argv.length === 0) {
    die("usage: pack-manager <verb> [--flags]");
  }
  const verb = argv[0];
  const args = parseArgs(argv.slice(1));

  const mod = await import("./pack-manager.js");

  switch (verb) {
    case "assemble-bp": {
      const src = need(args, "src");
      const out = need(args, "out");
      const name = need(args, "name");
      const icon = args["icon"];
      await mod.assembleBehaviorPack({
        srcDir: path.resolve(src),
        outDir: path.resolve(out),
        projectName: name,
        version: parseVersion(args["version"]),
        description: args["description"],
        ...(icon ? { iconSrc: path.resolve(icon) } : {}),
        ...(args["uuid"] ? { uuid: args["uuid"] } : {}),
        ...(args["module-uuid"] ? { moduleUuid: args["module-uuid"] } : {}),
      });
      process.stdout.write(`[pack-manager] assembled BP at ${out}\n`);
      return;
    }
    case "assemble-rp": {
      const modulesDir = need(args, "modules-dir");
      const out = need(args, "out");
      const name = need(args, "name");
      const map = mod.scanModuleResourcePacks(path.resolve(modulesDir));
      await mod.assembleResourcePack({
        moduleResourceDirs: map,
        outDir: path.resolve(out),
        projectName: name,
        version: parseVersion(args["version"]),
        description: args["description"],
        ...(args["uuid"] ? { uuid: args["uuid"] } : {}),
        ...(args["module-uuid"] ? { moduleUuid: args["module-uuid"] } : {}),
      });
      process.stdout.write(`[pack-manager] assembled RP at ${out} (${Object.keys(map).length} modules)\n`);
      return;
    }
    case "deploy": {
      const bdsRoot = need(args, "bds-root");
      const level = need(args, "level");
      const bpSrc = need(args, "bp-src");
      const bpName = need(args, "bp-name");
      const rpSrc = args["rp-src"];
      const rpName = args["rp-name"];
      await mod.deployToBDS({
        bdsRoot: path.resolve(bdsRoot),
        levelName: level,
        behaviorPackSrc: path.resolve(bpSrc),
        ...(rpSrc ? { resourcePackSrc: path.resolve(rpSrc) } : {}),
        bpName,
        ...(rpName ? { rpName } : {}),
      });
      process.stdout.write(`[pack-manager] deployed to ${path.join(bdsRoot, "worlds", level)}\n`);
      return;
    }
    case "enable-pack": {
      const worldsDir = need(args, "worlds-dir");
      const level = need(args, "level");
      const kind = need(args, "kind") as "behavior" | "resource";
      const packId = need(args, "pack-id");
      await mod.enablePackInWorld({
        worldsDir: path.resolve(worldsDir),
        levelName: level,
        kind,
        packUuid: packId,
        version: parseVersion(args["version"]),
      });
      process.stdout.write(`[pack-manager] enabled ${kind} pack ${packId} in ${level}\n`);
      return;
    }
    case "disable-pack": {
      const worldsDir = need(args, "worlds-dir");
      const level = need(args, "level");
      const kind = need(args, "kind") as "behavior" | "resource";
      const packId = need(args, "pack-id");
      await mod.disablePackInWorld({
        worldsDir: path.resolve(worldsDir),
        levelName: level,
        kind,
        packUuid: packId,
        version: parseVersion(args["version"] ?? "1,0,0"),
      });
      process.stdout.write(`[pack-manager] disabled ${kind} pack ${packId} in ${level}\n`);
      return;
    }
    case "ensure-permission": {
      const bdsRoot = need(args, "bds-root");
      const packId = need(args, "pack-id");
      const wrote = await mod.ensureConfigPermission(path.resolve(bdsRoot), packId);
      process.stdout.write(
        wrote
          ? `[pack-manager] wrote config/${packId}/permission.json\n`
          : `[pack-manager] config/${packId}/permission.json already exists — skipped\n`
      );
      return;
    }
    case "read-level": {
      const root = need(args, "bds-root");
      const name = await readLevelName(path.resolve(root));
      process.stdout.write(`${name}\n`);
      return;
    }
    default:
      die(`unknown verb: ${verb}`);
  }
}

main().catch((err: unknown) => {
  const msg = err instanceof Error ? (err.stack ?? err.message) : String(err);
  die(msg);
});