/** 游戏机通过 SSH 标准输入提交共享 QQ 配置；只在本机原子更新云端桥配置。 */
import { execFileSync } from "node:child_process";
import { createPrivateKey, createPublicKey, randomBytes, verify } from "node:crypto";
import { chownSync, chmodSync, readFileSync, renameSync, statSync, writeFileSync, rmSync } from "node:fs";
import { request } from "node:http";
import { dirname, join } from "node:path";

const CONFIG_PATH = "/var/lib/sfmc-qq-bridge/configs/qq_config.json";
const SERVICE = "sfmc-qq-bridge.service";
const PKCS8_ED25519_PREFIX = Buffer.from("302e020100300506032b657004220420", "hex");

function service(action) {
  execFileSync("systemctl", [action, SERVICE], { stdio: "ignore", timeout: 15_000 });
}

function readConfig() {
  return JSON.parse(readFileSync(CONFIG_PATH, "utf8"));
}

function privateKey(secret) {
  const source = Buffer.from(secret, "utf8");
  const seed = Buffer.alloc(32);
  for (let i = 0; i < seed.length; i++) seed[i] = source[i % source.length];
  return createPrivateKey({ key: Buffer.concat([PKCS8_ED25519_PREFIX, seed]), format: "der", type: "pkcs8" });
}

function checkChallenge(config) {
  return new Promise((resolve, reject) => {
    const eventTs = String(Math.floor(Date.now() / 1000));
    const plainToken = randomBytes(12).toString("hex");
    const body = JSON.stringify({ op: 13, d: { event_ts: eventTs, plain_token: plainToken } });
    const req = request(
      {
        hostname: "127.0.0.1",
        port: 3005,
        path: "/qqbot/webhook",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
          "X-Bot-Appid": config.official.app_id,
        },
        timeout: 1500,
      },
      (res) => {
        let answer = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => (answer += chunk));
        res.on("end", () => {
          try {
            const value = JSON.parse(answer);
            const signature = String(value.signature ?? "");
            const valid =
              res.statusCode === 200 &&
              value.plain_token === plainToken &&
              /^[0-9a-f]{128}$/i.test(signature) &&
              verify(
                null,
                Buffer.from(eventTs + plainToken),
                createPublicKey(privateKey(config.official.app_secret)),
                Buffer.from(signature, "hex")
              );
            if (valid) resolve();
            else reject(new Error("回调校验未通过"));
          } catch {
            reject(new Error("回调响应无效"));
          }
        });
      }
    );
    req.on("timeout", () => req.destroy(new Error("回调超时")));
    req.on("error", reject);
    req.end(body);
  });
}

async function waitUntilHealthy(config) {
  let lastError;
  for (let attempt = 0; attempt < 8; attempt++) {
    try {
      service("is-active");
      await checkChallenge(config);
      return;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
  throw lastError ?? new Error("服务未就绪");
}

function writeAtomic(value, previousStat) {
  const temporary = join(dirname(CONFIG_PATH), `.qq_config.sync-${process.pid}.tmp`);
  try {
    writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600, flag: "wx" });
    chownSync(temporary, previousStat.uid, previousStat.gid);
    chmodSync(temporary, 0o640);
    renameSync(temporary, CONFIG_PATH);
  } finally {
    rmSync(temporary, { force: true });
  }
}

function expectString(value, name, required = false) {
  if (typeof value !== "string" || (required && !value.trim())) throw new Error(`${name} 无效`);
  return value;
}

function sharedFields(payload) {
  const source = payload.shared;
  if (!source || typeof source !== "object" || Array.isArray(source)) throw new Error("共享配置无效");
  const official = source.official;
  if (!official || typeof official !== "object" || Array.isArray(official)) throw new Error("official 无效");
  if (!Array.isArray(official.admin_openids) || !official.admin_openids.every((id) => typeof id === "string")) {
    throw new Error("official.admin_openids 无效");
  }
  if (typeof official.sandbox !== "boolean" || typeof official.sync_menu_panel !== "boolean") {
    throw new Error("QQ 开关配置无效");
  }
  const publicServer = source.public_server;
  if (publicServer && (typeof publicServer !== "object" || Array.isArray(publicServer))) {
    throw new Error("public_server 无效");
  }
  const publicAddress = expectString(publicServer?.address ?? "", "public_server.address");
  const publicVersion = expectString(publicServer?.version ?? "", "public_server.version");
  const publicPort = publicServer?.port ?? 19132;
  if (!Number.isInteger(publicPort) || publicPort < 1 || publicPort > 65535) {
    throw new Error("public_server.port 无效");
  }
  return {
    official: {
      app_id: expectString(official.app_id, "official.app_id", true),
      app_secret: expectString(official.app_secret, "official.app_secret", true),
      sandbox: official.sandbox,
      group_openid: expectString(official.group_openid, "official.group_openid"),
      admin_openids: official.admin_openids,
      sync_menu_panel: official.sync_menu_panel,
    },
    public_server: { address: publicAddress, port: publicPort, version: publicVersion },
  };
}

async function main() {
  if (process.getuid?.() !== 0) throw new Error("同步程序必须由云端 root 执行");
  if (process.argv[2] === "--health") {
    await waitUntilHealthy(readConfig());
    process.stdout.write("Webhook 回调校验通过\n");
    return;
  }
  let input = "";
  for await (const part of process.stdin) {
    input += part;
    if (input.length > 65_536) throw new Error("同步请求过大");
  }
  const payload = JSON.parse(input);
  if (payload?.mode === "websocket") {
    service("stop");
    process.stdout.write("云端 Webhook 已停止\n");
    return;
  }
  if (payload?.mode !== "webhook") throw new Error("接收方式无效");

  const shared = sharedFields(payload);
  const current = readConfig();
  const next = {
    ...current,
    public_server: shared.public_server,
    qq_enabled: true,
    qq_backend: "official",
    official: {
      ...current.official,
      ...shared.official,
      transport: "webhook",
      webhook: { port: 3005, path: "/qqbot/webhook" },
      group_panel_id:
        current.official?.group_openid === shared.official.group_openid ? current.official?.group_panel_id ?? "" : "",
    },
    db_host: "127.0.0.1",
    db_port: 13001,
  };
  delete next.bridge_channel_id;
  delete next.mctoqq_prefix;
  if (JSON.stringify(next) === JSON.stringify(current)) {
    try {
      service("is-active");
      await checkChallenge(current);
    } catch {
      service("start");
      await waitUntilHealthy(current);
    }
    process.stdout.write("云端配置未变化，服务正常\n");
    return;
  }

  // 停止写回面板 ID 的进程后重读，避免覆盖同步期间刚生成的 ID。
  service("stop");
  let stoppedConfig;
  let previousStat;
  try {
    stoppedConfig = readConfig();
    next.official.group_panel_id =
      stoppedConfig.official?.group_openid === shared.official.group_openid
        ? stoppedConfig.official?.group_panel_id ?? ""
        : "";
    previousStat = statSync(CONFIG_PATH);
    const backupPath = `${CONFIG_PATH}.bak-sync`;
    writeFileSync(backupPath, readFileSync(CONFIG_PATH), { mode: 0o600 });
    chmodSync(backupPath, 0o600);
    writeAtomic(next, previousStat);
    service("restart");
    await waitUntilHealthy(next);
    process.stdout.write("云端 QQ 配置已更新，Webhook 校验通过\n");
  } catch {
    try {
      if (stoppedConfig && previousStat) writeAtomic(stoppedConfig, previousStat);
      service("restart");
      if (stoppedConfig) await waitUntilHealthy(stoppedConfig);
    } catch {
      throw new Error("云端配置应用失败，回滚未完成，请检查服务");
    }
    throw new Error("云端配置应用失败，已恢复上一版");
  }
}

main().catch((error) => {
  // 错误消息只包含字段名和状态，不输出收到的配置或凭据。
  process.stderr.write(`QQ 配置同步失败：${error.message}\n`);
  process.exitCode = 1;
});
