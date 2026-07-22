#!/usr/bin/env node
/**
 * tools/catalog-sync.mjs — 扫描 modules/packages/<id>/sapi/manifest.json → 重写 catalog.json
 *
 * 空 packages = 空 catalog，合法。
 * 同时 prune lock 中已不在 catalog 的业务模块条目。
 *
 * 用法: node tools/catalog-sync.mjs
 */
import { syncCatalogFromPackages } from "./lib/catalog.mjs";
import { pruneOrphanModuleLocks, readLock, setModuleLockEnabled } from "./lib/lock.mjs";
import { die } from "./lib/io.mjs";

try {
  const { catalog, count } = syncCatalogFromPackages();
  const ids = new Set(catalog.modules.map((m) => m.id));
  pruneOrphanModuleLocks(ids);

  // 为尚无 lock 条目的模块写入 enabledByDefault
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
  die("catalog-sync", e?.message ?? String(e));
}
