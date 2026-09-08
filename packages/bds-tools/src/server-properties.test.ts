import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { rmSafe } from "./fsx.js";
import {
  ensureEmitServerTelemetry,
  localizeServerProperties,
  localizeServerPropertiesContent,
  resolveBdsLocale,
} from "./server-properties.js";

const SAMPLE_VANILLA_PROPERTIES = `server-name=Dedicated Server
# Used as the server name
# Allowed values: Any string without semicolon symbol.

gamemode=survival
# Sets the game mode for new players.
# Allowed values: "survival", "creative", or "adventure"

force-gamemode=false
# Prevents the server from sending level settings to clients

allow-cheats=false
# If true then cheats like commands can be used.

custom-unknown-flag=hello-world
# This is a third-party or future setting
`;

describe("server-properties: localizeServerPropertiesContent", () => {
  it("将已知配置项的英文注释替换为中文，且严格保留用户配置值", () => {
    const customText = `server-name=我的世界服务器
# Used as the server name

gamemode=creative
# Sets the game mode for new players.

server-port=25565
`;
    const { content, modified } = localizeServerPropertiesContent(customText, "zh-CN");
    assert.equal(modified, true);

    // 验证值未被覆盖重置
    assert.match(content, /server-name=我的世界服务器/);
    assert.match(content, /gamemode=creative/);
    assert.match(content, /server-port=25565/);

    // 验证注释已转为中文
    assert.match(content, /# 服务器名称（显示在客户端局域网\/好友列表中）/);
    assert.match(content, /# 新玩家首次加入世界时的默认游戏模式/);
    assert.match(content, /# 服务端监听的 IPv4 UDP 网络通信端口/);
  });

  it("保持幂等性：二次运行输出内容完全一致，modified 为 false", () => {
    const firstRun = localizeServerPropertiesContent(SAMPLE_VANILLA_PROPERTIES, "zh-CN");
    assert.equal(firstRun.modified, true);

    const secondRun = localizeServerPropertiesContent(firstRun.content, "zh-CN");
    assert.equal(secondRun.modified, false);
    assert.equal(secondRun.content, firstRun.content);
  });

  it("保留未收录的未知项与第三方注释不变", () => {
    const { content } = localizeServerPropertiesContent(SAMPLE_VANILLA_PROPERTIES, "zh-CN");
    assert.match(content, /custom-unknown-flag=hello-world/);
    assert.match(content, /# This is a third-party or future setting/);
  });

  it("当 locale 为 en 或非中文时，跳过修改并返回 modified: false", () => {
    const resEn = localizeServerPropertiesContent(SAMPLE_VANILLA_PROPERTIES, "en");
    assert.equal(resEn.modified, false);
    assert.equal(resEn.content, SAMPLE_VANILLA_PROPERTIES);
  });

  it("空文本安全处理", () => {
    const res = localizeServerPropertiesContent("", "zh-CN");
    assert.equal(res.modified, false);
    assert.equal(res.content, "");
  });
});

describe("server-properties: 文件读写与磁盘集成", () => {
  it("localizeServerProperties 正确就地重写磁盘文件", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "sfmc-server-props-"));
    try {
      const propFile = path.join(tmp, "server.properties");
      fs.writeFileSync(propFile, "server-name=TestServer\ngamemode=survival\n", "utf8");

      const msgs: string[] = [];
      const ok = localizeServerProperties(tmp, {
        locale: "zh-CN",
        logger: { info: (m) => msgs.push(m) },
      });

      assert.equal(ok, true);
      assert.equal(msgs.length, 1);

      const updated = fs.readFileSync(propFile, "utf8");
      assert.match(updated, /server-name=TestServer/);
      assert.match(updated, /# 服务器名称/);

      // 二次执行跳过
      const okAgain = localizeServerProperties(tmp, { locale: "zh-CN" });
      assert.equal(okAgain, false);
    } finally {
      rmSafe(tmp);
    }
  });

  it("结合 ensureEmitServerTelemetry：新追加的遥测开关同样能获得中文注释", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "sfmc-server-props-telemetry-"));
    try {
      const propFile = path.join(tmp, "server.properties");
      fs.writeFileSync(propFile, "server-name=Dedicated Server\n", "utf8");

      // 1. 追加遥测
      const wrote = ensureEmitServerTelemetry(tmp);
      assert.equal(wrote, true);

      // 2. 本地化
      const ok = localizeServerProperties(tmp, { locale: "zh-CN" });
      assert.equal(ok, true);

      const content = fs.readFileSync(propFile, "utf8");
      assert.match(content, /emit-server-telemetry=true/);
      assert.match(content, /# 是否向 Mojang 发送服务器遥测与运行健康诊断数据/);
      assert.match(content, /# 提示：使用本平台时因您已同意 Mojang EULA 协议，按协议保持启用/);
    } finally {
      rmSafe(tmp);
    }
  });

  it("resolveBdsLocale 支持环境变量与系统回退", () => {
    const oldEnv = process.env.SFMC_LOCALE;
    try {
      process.env.SFMC_LOCALE = "zh-CN";
      assert.equal(resolveBdsLocale(), "zh-CN");

      process.env.SFMC_LOCALE = "en";
      assert.equal(resolveBdsLocale(), "en");
    } finally {
      if (oldEnv !== undefined) {
        process.env.SFMC_LOCALE = oldEnv;
      } else {
        delete process.env.SFMC_LOCALE;
      }
    }
  });
});
