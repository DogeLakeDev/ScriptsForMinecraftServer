#!/usr/bin/env node
// @ts-check
/**
 * 薄封装 → catalog sync（权威实现在 @sfmc-bds/cli）
 * 用法: node packages/tools/catalog-sync.mjs
 */
import { syncCatalogFromPackages } from "../cli/scripts/module-install/lib/catalog.mjs";
import { pruneOrphanModuleLocks, readLock, setModuleLockEnabled } from "../cli/scripts/module-install/lib/lock.mjs";
import { die } from "./lib/io.mjs";

try {
  const { catalog, count } = syncCatalogFromPackages();
  const ids = new Set(catalog.modules.map((m) => m.id));
  pruneOrphanModuleLocks(ids);

  const lock = readLock();
  for (const m of catalog.modules) {
    if (!lock.modules[m.id]) {
      setModuleLockEnabled(m.id, m.enabledByDefault !== false);
    }
  }

  console.log(`[catalog-sync] OK — ${count} module(s) → modules/catalog.json`);
  for (const m of catalog.modules) {
    console.log(`  ${m.id.padEnd(28)} folder=${m.entry.path.split("/")[2]}`);
  }
} catch (e) {
  const message = e instanceof Error ? e.message : String(e);
  die("catalog-sync", message);
}
