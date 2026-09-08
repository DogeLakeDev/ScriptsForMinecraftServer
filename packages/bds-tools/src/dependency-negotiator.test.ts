import assert from "node:assert/strict";
import test from "node:test";
import {
  BASELINE_BEDROCK_DEPENDENCIES,
  cleanBedrockVersion,
  compareBedrockVersion,
  isGametestBetaRequired,
  negotiateBedrockDependencies,
} from "./dependency-negotiator.js";

test("cleanBedrockVersion: 清理 npm range 符号", () => {
  assert.equal(cleanBedrockVersion("^2.0.0-beta"), "2.0.0-beta");
  assert.equal(cleanBedrockVersion(">=2.0.0-beta <3.0.0"), "2.0.0-beta");
  assert.equal(cleanBedrockVersion("~1.3.0"), "1.3.0");
  assert.equal(cleanBedrockVersion("v1.18.0"), "1.18.0");
  assert.equal(cleanBedrockVersion("  1.2.0  "), "1.2.0");
});

test("compareBedrockVersion: 大版本与次版本比较", () => {
  assert.ok(compareBedrockVersion("1.18.0", "1.3.0") > 0);
  assert.ok(compareBedrockVersion("1.3.0", "1.18.0") < 0);
  assert.equal(compareBedrockVersion("1.3.0", "1.3.0"), 0);
});

test("compareBedrockVersion: Beta 与正式版比较（跨大版本提升）", () => {
  // 2.0.0-beta 应高于 1.3.0
  assert.ok(compareBedrockVersion("2.0.0-beta", "1.3.0") > 0);
  // 同版本下正式版高于测试版
  assert.ok(compareBedrockVersion("2.0.0", "2.0.0-beta") > 0);
  // 两个 beta 之间次版本对比
  assert.ok(compareBedrockVersion("2.2.0-beta", "2.0.0-beta") > 0);
});

test("isGametestBetaRequired: 准确识别测试版玩法需求", () => {
  // 需要测试玩法的项
  assert.equal(
    isGametestBetaRequired({ module_name: "@minecraft/server-ui", version: "2.0.0-beta" }),
    true
  );
  assert.equal(
    isGametestBetaRequired({ module_name: "@minecraft/server", version: "2.10.0-beta" }),
    true
  );
  assert.equal(
    isGametestBetaRequired({ module_name: "@minecraft/server-gametest", version: "1.0.0" }),
    true
  );

  // 不需要测试玩法的稳定版或纯权限模块
  assert.equal(
    isGametestBetaRequired({ module_name: "@minecraft/server-ui", version: "1.3.0" }),
    false
  );
  assert.equal(
    isGametestBetaRequired({ module_name: "@minecraft/server", version: "1.18.0" }),
    false
  );
  assert.equal(
    isGametestBetaRequired({ module_name: "@minecraft/server-net", version: "1.0.0-beta" }),
    false
  );
  assert.equal(
    isGametestBetaRequired({ module_name: "@minecraft/server-admin", version: "1.0.0-beta" }),
    false
  );
});

test("negotiateBedrockDependencies: 无模组需求时保持基准依赖", () => {
  const result = negotiateBedrockDependencies(BASELINE_BEDROCK_DEPENDENCIES, []);
  assert.equal(result.dependencies.length, BASELINE_BEDROCK_DEPENDENCIES.length);
  assert.equal(result.promotions.length, 0);
  assert.equal(result.hasBetaApis, false);

  const uiDep = result.dependencies.find((d) => d.module_name === "@minecraft/server-ui");
  assert.equal(uiDep?.version, "1.3.0");
});

test("negotiateBedrockDependencies: 单模块提升 @minecraft/server-ui 至 2.0.0-beta", () => {
  const result = negotiateBedrockDependencies(BASELINE_BEDROCK_DEPENDENCIES, [
    {
      folderId: "custom-menu",
      dependencies: [
        { module_name: "@minecraft/server-ui", version: "2.0.0-beta" },
      ],
    },
  ]);

  const uiDep = result.dependencies.find((d) => d.module_name === "@minecraft/server-ui");
  assert.equal(uiDep?.version, "2.0.0-beta");
  assert.equal(result.hasBetaApis, true);
  assert.equal(result.promotions.length, 1);
  assert.equal(result.promotions[0].moduleName, "@minecraft/server-ui");
  assert.equal(result.promotions[0].from, "1.3.0");
  assert.equal(result.promotions[0].to, "2.0.0-beta");
  assert.deepEqual(result.promotions[0].requestedBy, ["custom-menu"]);
});

test("negotiateBedrockDependencies: 多模块不同版本需求取最高兼容", () => {
  const result = negotiateBedrockDependencies(BASELINE_BEDROCK_DEPENDENCIES, [
    {
      folderId: "mod-a",
      dependencies: [
        { module_name: "@minecraft/server-ui", version: "2.0.0-beta" },
      ],
    },
    {
      folderId: "mod-b",
      dependencies: [
        { module_name: "@minecraft/server-ui", version: "2.2.0-beta" },
      ],
    },
    {
      folderId: "mod-c",
      dependencies: [
        { module_name: "@minecraft/server-ui", version: "1.3.0" },
      ],
    },
  ]);

  const uiDep = result.dependencies.find((d) => d.module_name === "@minecraft/server-ui");
  assert.equal(uiDep?.version, "2.2.0-beta");
  assert.equal(result.hasBetaApis, true);
});

test("negotiateBedrockDependencies: 支持引入基准外新原生模块", () => {
  const result = negotiateBedrockDependencies(BASELINE_BEDROCK_DEPENDENCIES, [
    {
      folderId: "mod-gametest",
      dependencies: [
        { module_name: "@minecraft/server-gametest", version: "1.0.0-beta" },
      ],
    },
  ]);

  assert.ok(result.dependencies.some((d) => d.module_name === "@minecraft/server-gametest"));
  assert.equal(result.hasBetaApis, true);
});
