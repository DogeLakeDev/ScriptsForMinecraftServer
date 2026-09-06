/**
 * log-translator.test.ts — BDS 原版日志本地化翻译单测
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  applyRuleReplacement,
  interpolateRegexTemplate,
  translateBdsLog,
} from "./log-translator.js";

test("translateBdsLog: Beta APIs 缺失阻断", () => {
  const line =
    "Plugin [sfmc-modules - 1.0.0] - requesting dependency on beta APIs [@minecraft/server-admin - 1.0.0-beta], but the Beta APIs experiment is not enabled.";
  const res = translateBdsLog(line, "zh-CN");
  assert.equal(res.translated, true);
  assert.equal(res.ruleId, "beta-apis-missing");
  assert.ok(res.text.includes("插件「sfmc-modules - 1.0.0」依赖测试版 API (@minecraft/server-admin - 1.0.0-beta)"));
  assert.ok(res.text.includes("未开启「测试版 API (Beta APIs)」实验开关"));
});

test("translateBdsLog: 脚本语法错误 missing export", () => {
  const line = "SyntaxError: Could not find export 'Vector3' in module '@minecraft/server'";
  const res = translateBdsLog(line, "zh-CN");
  assert.equal(res.translated, true);
  assert.equal(res.ruleId, "script-syntax-missing-export");
  assert.ok(res.text.includes("模组尝试从「@minecraft/server」导入不存在的符号「Vector3」"));
});

test("translateBdsLog: 激活包在本地缺失", () => {
  const line = "Configured pack (id: 3116e462-9838-48bf-be53-354958c1810f, version: 1.21.100) was not found and was ignored";
  const res = translateBdsLog(line, "zh-CN");
  assert.equal(res.translated, true);
  assert.equal(res.ruleId, "configured-pack-missing");
  assert.ok(res.text.includes("UUID: 3116e462-9838-48bf-be53-354958c1810f"));
  assert.ok(res.text.includes("版本: 1.21.100"));
});

test("translateBdsLog: 自定义方块形态数量超限", () => {
  const line = "World with over 65536 block permutations may degrade performance. Current world has 74227 permutations.";
  const res = translateBdsLog(line, "zh-CN");
  assert.equal(res.translated, true);
  assert.equal(res.ruleId, "block-permutations-limit");
  assert.ok(res.text.includes("74227 个"));
  assert.ok(res.text.includes("超出推荐上限 65,536"));
});

test("translateBdsLog: 配方物品缺失", () => {
  const line =
    "[Recipes] recipes/japanese/mochi_rice.json | amp:mochi_rice | The Item: amp:mochi_rice is missing or invalid, can't make the recipe";
  const res = translateBdsLog(line, "zh-CN");
  assert.equal(res.translated, true);
  assert.equal(res.ruleId, "recipe-item-missing");
  assert.ok(res.text.includes("配方文件「recipes/japanese/mochi_rice.json」"));
  assert.ok(res.text.includes("物品「amp:mochi_rice」不存在或无效"));
});

test("translateBdsLog: 配方原料缺失", () => {
  const line =
    "[Recipes] recipes/japanese/rice_eel.json | amp:rice_eel | Recipe for: amp:rice_eel is missing (unknown) ingredient";
  const res = translateBdsLog(line, "zh-CN");
  assert.equal(res.translated, true);
  assert.equal(res.ruleId, "recipe-ingredient-missing");
  assert.ok(res.text.includes("产物: amp:rice_eel"));
  assert.ok(res.text.includes("缺少有效原料"));
});

test("translateBdsLog: 配方产物格式错误", () => {
  const line = "[Recipes] recipes/furniture/money.json | amp:money | Recipe result malformed";
  const res = translateBdsLog(line, "zh-CN");
  assert.equal(res.translated, true);
  assert.equal(res.ruleId, "recipe-result-malformed");
  assert.ok(res.text.includes("产物结果定义格式错误"));
});

test("translateBdsLog: 方块 Schema 未知组件与子属性错误", () => {
  const line1 =
    "[Blocks] block_definitions | worlds/Bedrock level/behavior_packs/[BP] TouHouLittleMaid_BP | blocks/skull/fairy_skull_2.json |  -> components -> tlm:skull: this component was found in the input, but is not present in the Schema";
  const res1 = translateBdsLog(line1, "zh-CN");
  assert.equal(res1.translated, true);
  assert.equal(res1.ruleId, "block-component-schema-unknown");
  assert.ok(res1.text.includes("blocks/skull/fairy_skull_2.json"));
  assert.ok(res1.text.includes("未知组件: components -> tlm:skull"));

  const line2 =
    "[Blocks] block_definitions | worlds/Bedrock level/behavior_packs/[BP] [BM] [自研] [玩法] GlobalCuisine_BP | blocks/steamer/steamer.json | worlds/Bedrock level/behavior_packs/[BP] [BM] [自研] [玩法] GlobalCuisine_BP | blocks/steamer/steamer.json | amp:steamer | components | amp:steamer | child 'amp:steamer' not valid here.";
  const res2 = translateBdsLog(line2, "zh-CN");
  assert.equal(res2.translated, true);
  assert.equal(res2.ruleId, "block-child-component-invalid");
  assert.ok(res2.text.includes("blocks/steamer/steamer.json"));
  assert.ok(res2.text.includes("子属性「amp:steamer」在此处无效"));
});

test("translateBdsLog: 脚本组件未注册", () => {
  const line = "[Scripting] Component 'tlm:deprecated' was not registered in script but used on an item";
  const res = translateBdsLog(line, "zh-CN");
  assert.equal(res.translated, true);
  assert.equal(res.ruleId, "script-component-not-registered");
  assert.ok(res.text.includes("自定义组件「tlm:deprecated」"));
});

test("translateBdsLog: 服务端生命周期与端口", () => {
  assert.equal(translateBdsLog("Server started.", "zh-CN").text, "[服务端] BDS 服务端已成功启动，准备就绪。");
  assert.equal(translateBdsLog("Stopping server...", "zh-CN").text, "[服务端] 正在关闭服务端...");
  assert.equal(translateBdsLog("Quit correctly", "zh-CN").text, "[服务端] 服务端已正常安全退出。");
  assert.equal(
    translateBdsLog("IPv4 supported, port: 19132: Used for gameplay and LAN discovery", "zh-CN").text,
    "[网络] IPv4 游戏与局域网发现端口: 19132 (UDP)"
  );
  assert.equal(
    translateBdsLog("Allow list is enabled but contains no entries.", "zh-CN").text,
    "[白名单警告] 白名单功能已开启但名单为空！除管理员外其他玩家将无法加入服务器。"
  );
});

test("translateBdsLog: 玩家加入与离开", () => {
  const join = translateBdsLog("Player connected: Steve, xuid: 2535412345678901", "zh-CN");
  assert.equal(join.text, "[玩家连接] 玩家 Steve 已加入世界 (XUID: 2535412345678901)");

  const leave = translateBdsLog("Player disconnected: Steve, xuid: 2535412345678901", "zh-CN");
  assert.equal(leave.text, "[玩家断开] 玩家 Steve 已离开世界 (XUID: 2535412345678901)");
});

test("translateBdsLog: 未匹配行原样返回", () => {
  const plain = "A custom line that has no translation rule.";
  const res = translateBdsLog(plain, "zh-CN");
  assert.equal(res.translated, false);
  assert.equal(res.text, plain);
});

test("interpolateRegexTemplate & applyRuleReplacement", () => {
  const m = "Hello world 123".match(/Hello (\w+) (\d+)/);
  assert.ok(m);
  const out = interpolateRegexTemplate(m, "Greeting $1 with id $2");
  assert.equal(out, "Greeting world with id 123");

  const replaced = applyRuleReplacement(
    "Warning: player Steve did action 5",
    /Warning: player (\w+) did action (\d+)/,
    "警告: 玩家 $1 触发了行为 $2"
  );
  assert.equal(replaced, "警告: 玩家 Steve 触发了行为 5");
});
