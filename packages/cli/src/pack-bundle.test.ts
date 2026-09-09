import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { build } from "esbuild";
import { createSdkResolvePlugin } from "./pack-lifecycle.js";
import { resolveSdkPackageRoot } from "./runtime.js";

test("pack bundling: sfmc:host bundles installHostBootstrap without unbundled SDK imports", async () => {
  const sdkRoot = resolveSdkPackageRoot();
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "sfmc-bundle-test-"));
  const dummyModFile = path.join(tmpDir, "dummy-mod.ts");

  fs.writeFileSync(
    dummyModFile,
    `
import { ModuleRegistry } from "@sfmc-bds/sdk/module-loader";
import { Command, Permission } from "@sfmc-bds/sdk/sapi/runtime";
globalThis.__testEvalOrder = (globalThis.__testEvalOrder || []).concat("module");
Command.register("dummy", Permission.Any, () => undefined, "dummy", "test-feature");
ModuleRegistry.register({ id: "test-feature", lifecycle: {} });
`
  );

  try {
    const res = await build({
      stdin: {
        contents: [
          'import "sfmc:host";',
          `import ${JSON.stringify(dummyModFile.replace(/\\/g, "/"))};`,
        ].join("\n"),
        resolveDir: tmpDir,
        sourcefile: "bootstrap.ts",
        loader: "ts",
      },
      write: false,
      bundle: true,
      platform: "neutral",
      format: "esm",
      target: "es2022",
      external: ["@minecraft/*"],
      plugins: [createSdkResolvePlugin(sdkRoot)],
    });

    const code = res.outputFiles[0].text;

    // 1. 确保未残留未打包的 @sfmc-bds/sdk import
    assert.doesNotMatch(
      code,
      /import\s+.*from\s+["']@sfmc(?:-bds)?\/sdk/i,
      "Bundle must not contain unbundled @sfmc-bds/sdk bare imports"
    );

    // 2. 确保 installHostBootstrap 包含在产物中且已被调用
    assert.match(code, /installHostBootstrap\(\)/, "Bundle must call installHostBootstrap()");

    // 3. 确保所有外部 import 均局限于 @minecraft/* 原生模块
    const importLines = code
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.startsWith("import ") && l.includes(" from "));
    for (const line of importLines) {
      assert.match(
        line,
        /from\s+["']@minecraft\//,
        `Unexpected external import line in bundle: ${line}`
      );
    }

    // 4. 确保 installHostBootstrap 在业务模块 evaluation 之前执行
    const hostCallIdx = code.indexOf("installHostBootstrap();");
    const modMarkerIdx = code.indexOf("__testEvalOrder");
    assert.ok(hostCallIdx !== -1, "installHostBootstrap call exists");
    assert.ok(modMarkerIdx !== -1, "module eval marker exists");
    assert.ok(
      hostCallIdx < modMarkerIdx,
      `installHostBootstrap() (idx: ${hostCallIdx}) must execute before module evaluation (idx: ${modMarkerIdx})`
    );

    // 5. SDK 子路径会分别预打包，但所有副本必须绑定同一个全局命令/权限状态。
    const commandStateRefs = code.match(/__sfmcCommandState/g)?.length ?? 0;
    const permissionStateRefs = code.match(/__sfmcPermissionRegistry/g)?.length ?? 0;
    assert.ok(commandStateRefs >= 2, "Bundled SDK copies must share __sfmcCommandState");
    assert.ok(permissionStateRefs >= 2, "Bundled SDK copies must share __sfmcPermissionRegistry");
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("extractModuleBedrockDependencies: 从 sapi/manifest.json 与 package.json 提取原生依赖", async () => {
  const { extractModuleBedrockDependencies } = await import("./pack-lifecycle.js");
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "sfmc-extract-dep-test-"));
  try {
    fs.mkdirSync(path.join(tmpDir, "sapi"), { recursive: true });
    fs.writeFileSync(
      path.join(tmpDir, "sapi", "manifest.json"),
      JSON.stringify({
        schemaVersion: 2,
        id: "test-menu",
        name: "测试菜单",
        configKey: "test",
        requires: [],
        permissions: [],
        dependencies: [
          { module_name: "@minecraft/server-ui", version: "2.0.0-beta" },
        ],
      })
    );
    fs.writeFileSync(
      path.join(tmpDir, "package.json"),
      JSON.stringify({
        peerDependencies: {
          "@minecraft/server": ">=1.18.0",
        },
        devDependencies: {
          "@minecraft/server": "2.10.0-beta.1.26.40-preview.30",
        },
      })
    );

    const deps = await extractModuleBedrockDependencies(tmpDir);
    assert.equal(deps.length, 2);
    assert.ok(deps.some((d) => d.module_name === "@minecraft/server-ui" && d.version === "2.0.0-beta"));
    assert.ok(deps.some((d) => d.module_name === "@minecraft/server" && d.version === ">=1.18.0"));
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
