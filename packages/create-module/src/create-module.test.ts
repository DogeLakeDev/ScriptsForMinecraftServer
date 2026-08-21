import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { createModule } from "./create-module.js";

function mkTmp(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "sfmc-create-module-"));
}

test("createModule minimal 生成可识别骨架", async () => {
  const root = mkTmp();
  const target = path.join(root, "hello-mod");
  const r = await createModule({
    targetDir: target,
    id: "hello-mod",
    name: "你好模块",
    scope: "alice",
  });
  assert.equal(r.pkgName, "@alice/sfmc-module-hello-mod");
  assert.equal(r.featureId, "feature-hello-mod");
  assert.ok(fs.existsSync(path.join(target, "package.json")));
  assert.ok(fs.existsSync(path.join(target, "sapi", "manifest.json")));
  assert.ok(fs.existsSync(path.join(target, "sapi", "src", "index.ts")));
  assert.ok(fs.existsSync(path.join(target, "test", "hello-mod.test.ts")));
  const pkg = JSON.parse(fs.readFileSync(path.join(target, "package.json"), "utf8")) as {
    name: string;
  };
  assert.equal(pkg.name, "@alice/sfmc-module-hello-mod");
  const manifest = JSON.parse(fs.readFileSync(path.join(target, "sapi", "manifest.json"), "utf8")) as {
    id: string;
    configKey: string;
    permissions: string[];
  };
  assert.equal(manifest.id, "feature-hello-mod");
  assert.equal(manifest.configKey, "hello_mod");
  assert.ok(manifest.permissions.includes("config:read:hello_mod"));
  const readme = fs.readFileSync(path.join(target, "README.md"), "utf8");
  assert.ok(!/Sapience|rename\.mjs|sfmc-module-template/i.test(readme));
  assert.ok(!fs.existsSync(path.join(target, "scripts", "rename.mjs")));
});

test("createModule --official + extra db", async () => {
  const root = mkTmp();
  const target = path.join(root, "db-mod");
  const r = await createModule({
    targetDir: target,
    id: "db-mod",
    official: true,
    extras: ["db"],
  });
  assert.equal(r.pkgName, "@sfmc-bds/module-db-mod");
  const manifest = JSON.parse(fs.readFileSync(path.join(target, "sapi", "manifest.json"), "utf8")) as {
    permissions: string[];
    notes: string;
  };
  assert.ok(manifest.permissions.includes("db:read:sfmc_db_mod"));
  assert.ok(manifest.permissions.includes("db:write:sfmc_db_mod"));
  assert.match(manifest.notes, /db/i);
});

test("拒绝非法 id / 非空目录", async () => {
  await assert.rejects(() => createModule({ targetDir: mkTmp(), id: "Feature", scope: "a" }));
  await assert.rejects(() => createModule({ targetDir: mkTmp(), id: "feature-x", scope: "a" }));
  const root = mkTmp();
  fs.writeFileSync(path.join(root, "keep.txt"), "x");
  await assert.rejects(() => createModule({ targetDir: root, id: "ok-mod", scope: "a" }));
});
