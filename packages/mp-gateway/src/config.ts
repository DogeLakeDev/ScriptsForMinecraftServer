/**
 * config.ts — 网关启动参数
 *
 * 使用场景：main.ts 解析命令行与环境变量得到 GatewayConfig，交给 server.ts 创建监听；
 * bridge.ts 用其中的 root / node / entry 启动 `sfmc manage --stdio`，upload.ts 用 root 定位收件箱。
 * 参数优先级：命令行 > 环境变量 > 默认值。访问令牌缺省时写入实例目录，重启后保持不变。
 */
import { randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";

/** 网关运行配置（启动后只读） */
export interface GatewayConfig {
  /** 实例部署根目录（SFMC_ROOT），每条管理会话都固定连接这个目录 */
  root: string;
  /** 监听地址。默认只听本机，由 Nginx 等反向代理提供 wss/https */
  host: string;
  port: number;
  /** 小程序请求头 `Authorization: Bearer <token>` 需要携带的访问令牌 */
  token: string;
  /** 令牌来源，启动横幅据此决定是否把新生成的令牌打印出来 */
  tokenSource: "argument" | "environment" | "file" | "generated";
  /** 令牌文件路径（tokenSource 为 file / generated 时有意义） */
  tokenFile: string;
  /** 运行 CLI 使用的 Node 可执行文件 */
  node: string;
  /** SFMC CLI 入口（launcher.mjs 或 @sfmc-bds/sfmc/bin/sfmc.mjs） */
  entry: string;
  /** 同时保持的管理会话上限，每个会话对应一个 CLI 子进程 */
  maxSessions: number;
  /** 单个世界包上传的字节上限 */
  maxUploadBytes: number;
  /** 位于反向代理之后时，用 X-Forwarded-For 识别客户端地址（用于鉴权失败限流） */
  trustProxy: boolean;
  /**
   * 微信小程序登录配置；AppId 与 AppSecret 都配置时才启用玩家登录、按角色授权管理端与桌面端扫码登录。
   * 未配置时这些接口统一回“未启用微信登录”，网关对其他部署者仍只用静态令牌。
   */
  wechat: WechatConfig | null;
  /** 玩家会话与设备凭证的 HMAC 签名密钥（首次启动生成并保存在令牌文件中） */
  sessionSecret: string;
  /** 本机 db-server 地址（查询微信绑定与玩家等级） */
  dbUrl: string;
  /** 已授权桌面设备的持久化文件 */
  devicesFile: string;
}

/** 微信小程序登录配置。使用场景：wechat.ts 调用 code2session。 */
export interface WechatConfig {
  appId: string;
  /** 只从环境变量读取，避免出现在进程参数列表里 */
  appSecret: string;
}

/** 命令行帮助文本。使用场景：`sfmc-mp-gateway --help` 与参数错误时输出。 */
export const HELP_TEXT = `用法: sfmc-mp-gateway --root <实例目录> [选项]

选项:
  --root <dir>          SFMC 部署根目录（也可用环境变量 SFMC_ROOT）
  --host <addr>         监听地址，默认 127.0.0.1（SFMC_MP_GATEWAY_HOST）
  --port <n>            监听端口，默认 3910（SFMC_MP_GATEWAY_PORT）
  --token <text>        访问令牌（SFMC_MP_GATEWAY_TOKEN）；缺省读取或生成 <root>/.sfmc/mp-gateway.json
  --entry <file>        SFMC CLI 入口；缺省依次查找 .sfmc/runtime/launcher.mjs 与 node_modules/@sfmc-bds/sfmc/bin/sfmc.mjs
  --node <file>         运行 CLI 的 Node，默认当前 Node
  --max-sessions <n>    同时在线的管理会话上限，默认 4
  --max-upload-mb <n>   单个世界包上传上限（MB），默认 256
  --trust-proxy         信任反向代理的 X-Forwarded-For
  --wx-appid <id>       微信小程序 AppId（SFMC_MP_WX_APPID）；AppSecret 只读环境变量 SFMC_MP_WX_SECRET
  --db-url <url>        本机 db-server 地址（SFMC_MP_DB_URL），默认读取 configs/db_config.json 的 db_port
  -h, --help            显示帮助
`;

/** 访问令牌文件的内容结构 */
interface TokenFile {
  token?: unknown;
  sessionSecret?: unknown;
}

/** db-server 默认端口（与 db-server env.ts 的缺省值一致） */
const DEFAULT_DB_PORT = 3001;

/** 令牌至少 24 个字符，避免误把短口令暴露到公网 */
const MIN_TOKEN_LENGTH = 24;

/** 把正整数参数解析为数字；非法时抛出带参数名的错误 */
function positiveInt(value: string | undefined, fallback: number, label: string): number {
  if (value === undefined || value === "") return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) throw new Error(`${label} 必须是正整数`);
  return parsed;
}

/**
 * 依次查找 CLI 入口。
 * 使用场景：桌面端接入过的实例有 `.sfmc/runtime/launcher.mjs`（跟随 active.json 切换平台版本）；
 * 用 pnpm 安装的实例则使用 node_modules 里的 @sfmc-bds/sfmc。与平台维护流程（maintenance.ts）的查找顺序一致。
 */
export function resolveCliEntry(root: string): string | undefined {
  const candidates = [
    path.join(root, ".sfmc", "runtime", "launcher.mjs"),
    path.join(root, "node_modules", "@sfmc-bds", "sfmc", "bin", "sfmc.mjs"),
  ];
  return candidates.find((file) => fs.existsSync(file));
}

/**
 * 读取或生成访问令牌。
 * 使用场景：未通过参数或环境变量指定令牌时，首次启动生成随机令牌并以 0600 权限写入实例目录，之后复用。
 */
function loadOrCreateToken(file: string): { token: string; generated: boolean } {
  if (fs.existsSync(file)) {
    const parsed = JSON.parse(fs.readFileSync(file, "utf8")) as TokenFile;
    if (typeof parsed.token !== "string" || parsed.token.length < MIN_TOKEN_LENGTH) throw new Error(`令牌文件无效: ${file}`);
    return { token: parsed.token, generated: false };
  }
  const token = randomBytes(32).toString("base64url");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify({ token, createdAt: new Date().toISOString() }, null, 2) + "\n", { encoding: "utf8", mode: 0o600 });
  return { token, generated: true };
}

/**
 * 读取或生成会话签名密钥。
 * 使用场景：与访问令牌保存在同一个 0600 文件里（字段 sessionSecret）；已有文件只追加该字段，不改动令牌。
 * 密钥变化会使所有玩家会话与设备凭证失效，因此一经生成就固定复用。
 */
function loadOrCreateSessionSecret(file: string): string {
  const existing = fs.existsSync(file) ? (JSON.parse(fs.readFileSync(file, "utf8")) as TokenFile & Record<string, unknown>) : {};
  if (typeof existing.sessionSecret === "string" && existing.sessionSecret.length >= MIN_TOKEN_LENGTH) return existing.sessionSecret;
  const sessionSecret = randomBytes(32).toString("base64url");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify({ ...existing, sessionSecret }, null, 2) + "\n", { encoding: "utf8", mode: 0o600 });
  return sessionSecret;
}

/**
 * 推导本机 db-server 地址。
 * 使用场景：未显式指定 --db-url 时，读取实例 configs/db_config.json 的 db_port（db-server 只监听 127.0.0.1）。
 */
function resolveDbUrl(root: string): string {
  let port = DEFAULT_DB_PORT;
  try {
    let text = fs.readFileSync(path.join(root, "configs", "db_config.json"), "utf8");
    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
    const parsed = Number((JSON.parse(text) as { db_port?: unknown }).db_port);
    if (Number.isInteger(parsed) && parsed > 0) port = parsed;
  } catch {
    // 文件不存在或格式不对时用默认端口，与 db-server 的缺省行为一致
  }
  return `http://127.0.0.1:${port}`;
}

/**
 * 解析命令行与环境变量。
 * 返回 null 表示用户只请求了帮助；参数不合法时抛出错误，由 main.ts 打印后退出。
 */
export function parseGatewayConfig(argv: string[], env: NodeJS.ProcessEnv): GatewayConfig | null {
  const { values } = parseArgs({
    args: argv,
    options: {
      root: { type: "string" },
      host: { type: "string" },
      port: { type: "string" },
      token: { type: "string" },
      entry: { type: "string" },
      node: { type: "string" },
      "max-sessions": { type: "string" },
      "max-upload-mb": { type: "string" },
      "trust-proxy": { type: "boolean" },
      "wx-appid": { type: "string" },
      "db-url": { type: "string" },
      help: { type: "boolean", short: "h" },
    },
    strict: true,
  });
  if (values.help) return null;

  const rootInput = values.root ?? env.SFMC_ROOT;
  if (!rootInput) throw new Error("缺少 --root（或环境变量 SFMC_ROOT）");
  const root = path.resolve(rootInput);
  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) throw new Error(`实例目录不存在: ${root}`);

  const entry = values.entry ? path.resolve(values.entry) : resolveCliEntry(root);
  if (!entry || !fs.existsSync(entry)) {
    throw new Error("找不到 SFMC CLI 入口。请先用桌面端或 pnpm 部署实例，或通过 --entry 指定 sfmc.mjs");
  }

  const tokenFile = path.join(root, ".sfmc", "mp-gateway.json");
  let token: string;
  let tokenSource: GatewayConfig["tokenSource"];
  if (values.token) {
    token = values.token;
    tokenSource = "argument";
  } else if (env.SFMC_MP_GATEWAY_TOKEN) {
    token = env.SFMC_MP_GATEWAY_TOKEN;
    tokenSource = "environment";
  } else {
    const loaded = loadOrCreateToken(tokenFile);
    token = loaded.token;
    tokenSource = loaded.generated ? "generated" : "file";
  }
  if (token.length < MIN_TOKEN_LENGTH) throw new Error(`访问令牌至少需要 ${MIN_TOKEN_LENGTH} 个字符`);

  const wxAppId = (values["wx-appid"] ?? env.SFMC_MP_WX_APPID ?? "").trim();
  const wxAppSecret = (env.SFMC_MP_WX_SECRET ?? "").trim();
  if (Boolean(wxAppId) !== Boolean(wxAppSecret)) throw new Error("微信登录需要同时配置 AppId（--wx-appid / SFMC_MP_WX_APPID）与 AppSecret（SFMC_MP_WX_SECRET）");
  const dbUrl = (values["db-url"] ?? env.SFMC_MP_DB_URL ?? "").trim().replace(/\/+$/, "") || resolveDbUrl(root);

  return {
    root,
    host: values.host ?? env.SFMC_MP_GATEWAY_HOST ?? "127.0.0.1",
    port: positiveInt(values.port ?? env.SFMC_MP_GATEWAY_PORT, 3910, "--port"),
    token,
    tokenSource,
    tokenFile,
    node: values.node ? path.resolve(values.node) : process.execPath,
    entry,
    maxSessions: positiveInt(values["max-sessions"], 4, "--max-sessions"),
    maxUploadBytes: positiveInt(values["max-upload-mb"], 256, "--max-upload-mb") * 1024 * 1024,
    trustProxy: values["trust-proxy"] === true,
    wechat: wxAppId ? { appId: wxAppId, appSecret: wxAppSecret } : null,
    sessionSecret: loadOrCreateSessionSecret(tokenFile),
    dbUrl,
    devicesFile: path.join(root, ".sfmc", "mp-gateway-devices.json"),
  };
}
