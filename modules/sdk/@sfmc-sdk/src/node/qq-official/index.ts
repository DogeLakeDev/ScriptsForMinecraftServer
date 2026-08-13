/**
 * QQ 开放平台官方 Bot 薄客户端
 *
 * - Access Token（client_credentials）缓存与提前刷新
 * - 群聊主动文本消息
 * - Gateway URL 查询（供 qq-bridge 入站）
 *
 * 不依赖已弃用的 Bot Token / qq-guild-bot SDK。
 */

/** Token 接口（正式/沙箱通用） */
export const QQ_TOKEN_URL = "https://api.bot.qq.com/app/getAppAccessToken";

/** 正式环境 OpenAPI / Gateway */
export const QQ_API_BASE_PROD = "https://api.sgroup.qq.com";

/** 沙箱环境 OpenAPI / Gateway */
export const QQ_API_BASE_SANDBOX = "https://sandbox.api.sgroup.qq.com";

/** GROUP_AND_C2C_EVENT：含 GROUP_AT_MESSAGE_CREATE / C2C_MESSAGE_CREATE */
export const QQ_INTENT_GROUP_AND_C2C = 1 << 25;

/** INTERACTION：含 INTERACTION_CREATE（回调按钮） */
export const QQ_INTENT_INTERACTION = 1 << 26;

/** Identify 常用组合：群/C2C + 交互 */
export const QQ_INTENT_GROUP_C2C_INTERACTION = QQ_INTENT_GROUP_AND_C2C | QQ_INTENT_INTERACTION;

/** 提前多少秒刷新 token（官方建议临近 60s 窗口） */
const TOKEN_REFRESH_MARGIN_SEC = 60;

export type QqOfficialCredentials = {
  appId: string;
  appSecret: string;
  sandbox?: boolean;
};

export type AccessTokenCache = {
  accessToken: string;
  /** 过期时刻（epoch ms） */
  expiresAtMs: number;
};

export type FetchLike = typeof fetch;

export function resolveApiBase(sandbox?: boolean): string {
  return sandbox ? QQ_API_BASE_SANDBOX : QQ_API_BASE_PROD;
}

/**
 * Access Token 管理器：进程内缓存，过期前 margin 秒主动刷新。
 * 可注入 fetch 便于单测。
 */
/**
 * Parameter properties 改为显式赋值，避免 strip-only 测试路径踩坑；
 * 正式构建走 esbuild，两种写法均可。
 */
export class QqAccessTokenManager {
  private cache: AccessTokenCache | null = null;
  private inflight: Promise<string> | null = null;
  private readonly creds: QqOfficialCredentials;
  private readonly fetchImpl: FetchLike;

  constructor(creds: QqOfficialCredentials, fetchImpl: FetchLike = fetch) {
    this.creds = creds;
    this.fetchImpl = fetchImpl;
  }

  /** 测试用：清空缓存 */
  clearCache(): void {
    this.cache = null;
  }

  /** 测试用：窥视缓存 */
  peekCache(): AccessTokenCache | null {
    return this.cache;
  }

  async getAccessToken(): Promise<string> {
    const now = Date.now();
    if (this.cache && now < this.cache.expiresAtMs - TOKEN_REFRESH_MARGIN_SEC * 1000) {
      return this.cache.accessToken;
    }
    if (this.inflight) return this.inflight;
    this.inflight = this.refresh().finally(() => {
      this.inflight = null;
    });
    return this.inflight;
  }

  private async refresh(): Promise<string> {
    const res = await this.fetchImpl(QQ_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        appId: this.creds.appId,
        clientSecret: this.creds.appSecret,
      }),
    });
    const text = await res.text();
    if (!res.ok) {
      throw new Error(`getAppAccessToken HTTP ${res.status}: ${text.slice(0, 200)}`);
    }
    let json: { access_token?: string; expires_in?: string | number };
    try {
      json = JSON.parse(text) as { access_token?: string; expires_in?: string | number };
    } catch {
      throw new Error(`getAppAccessToken 非 JSON: ${text.slice(0, 200)}`);
    }
    const accessToken = String(json.access_token ?? "");
    if (!accessToken) {
      throw new Error(`getAppAccessToken 缺 access_token: ${text.slice(0, 200)}`);
    }
    const expiresIn = Math.max(1, parseInt(String(json.expires_in ?? "7200"), 10) || 7200);
    this.cache = {
      accessToken,
      expiresAtMs: Date.now() + expiresIn * 1000,
    };
    return accessToken;
  }

  /** Authorization 头值：`QQBot {token}` */
  async authorizationHeader(): Promise<string> {
    const token = await this.getAccessToken();
    return `QQBot ${token}`;
  }
}

export type SendGroupTextOptions = {
  groupOpenid: string;
  content: string;
  /** 被动回复时携带；主动推送请省略 */
  msgId?: string;
  msgSeq?: number;
};

export type SendGroupTextResult =
  | { ok: true; id?: string; status: number; body: string }
  | { ok: false; status: number; body: string; error: string };

/** 官方内嵌键盘按钮：type=2 指令 / type=1 回调 */
export type QqKeyboardButton = {
  id: string;
  label: string;
  /** 点击后填入/发送的指令文本，或回调 data */
  data: string;
  /** 渲染样式：0 灰线 / 1 蓝线 / 2 白字 / 3 蓝底白字 */
  style?: number;
  /**
   * 0=跳转 1=回调（INTERACTION）2=指令（默认）
   */
  actionType?: 0 | 1 | 2;
  /** 点击后展示文案 */
  visitedLabel?: string;
  /** 操作权限；缺省 type=2 时所有人可点 */
  permission?: {
    type: 0 | 1 | 2;
    specify_user_ids?: string[];
    specify_role_ids?: string[];
  };
  unsupportTips?: string;
};

export type SendGroupMessageOptions = {
  groupOpenid: string;
  /**
   * 0=纯文本(content) 2=Markdown(markdown)；带 keyboard 时常用 2。
   * 传了 markdown 后 content 必须为空（官方约束）。
   */
  msgType?: 0 | 2;
  content?: string;
  markdown?: string;
  /** 内嵌键盘；按行分组，未分组时自动每行最多 3 个按钮 */
  keyboardButtons?: QqKeyboardButton[];
  keyboardRows?: QqKeyboardButton[][];
  msgId?: string;
  msgSeq?: number;
};

function buildKeyboardPayload(
  opts: Pick<SendGroupMessageOptions, "keyboardButtons" | "keyboardRows">
): Record<string, unknown> | undefined {
  const rowsSrc =
    opts.keyboardRows ??
    (opts.keyboardButtons && opts.keyboardButtons.length > 0
      ? chunkButtons(opts.keyboardButtons, 3)
      : undefined);
  if (!rowsSrc || rowsSrc.length === 0) return undefined;
  return {
    content: {
      rows: rowsSrc.map((row) => ({
        buttons: row.map((btn) => {
          const actionType = btn.actionType ?? 2;
          const permission = btn.permission ?? { type: 2 as const };
          return {
            id: btn.id,
            render_data: {
              label: btn.label.slice(0, 10),
              visited_label: (btn.visitedLabel ?? btn.label).slice(0, 10),
              style: btn.style ?? 1,
            },
            action: {
              type: actionType,
              permission,
              data: btn.data,
              unsupport_tips: btn.unsupportTips ?? "请升级 QQ 客户端",
            },
          };
        }),
      })),
    },
  };
}

function chunkButtons(buttons: QqKeyboardButton[], size: number): QqKeyboardButton[][] {
  const rows: QqKeyboardButton[][] = [];
  for (let i = 0; i < buttons.length; i += size) {
    rows.push(buttons.slice(i, i + size));
  }
  return rows;
}

/**
 * 发送群聊消息（文本 / Markdown / 内嵌键盘）。
 * 失败不抛错，返回 `{ ok: false }`。
 */
export async function sendGroupMessage(
  creds: QqOfficialCredentials,
  opts: SendGroupMessageOptions,
  deps?: {
    tokenManager?: QqAccessTokenManager;
    fetchImpl?: FetchLike;
  }
): Promise<SendGroupTextResult> {
  const fetchImpl = deps?.fetchImpl ?? fetch;
  const tokenMgr = deps?.tokenManager ?? new QqAccessTokenManager(creds, fetchImpl);
  let auth: string;
  try {
    auth = await tokenMgr.authorizationHeader();
  } catch (e) {
    return {
      ok: false,
      status: 0,
      body: "",
      error: (e as Error).message,
    };
  }

  const markdown = opts.markdown?.trim();
  const msgType: 0 | 2 = opts.msgType ?? (markdown ? 2 : 0);
  const payload: Record<string, unknown> = {
    msg_type: msgType,
  };
  if (msgType === 2) {
    // 官方：传 markdown 后 content 必须为空
    payload.markdown = { content: markdown ?? "" };
  } else {
    payload.content = opts.content ?? "";
  }

  const keyboard = buildKeyboardPayload(opts);
  if (keyboard) payload.keyboard = keyboard;

  if (opts.msgId) {
    payload.msg_id = opts.msgId;
    if (opts.msgSeq !== undefined) payload.msg_seq = opts.msgSeq;
  }

  const base = resolveApiBase(creds.sandbox);
  const url = `${base}/v2/groups/${encodeURIComponent(opts.groupOpenid)}/messages`;

  try {
    const res = await fetchImpl(url, {
      method: "POST",
      headers: {
        Authorization: auth,
        "Content-Type": "application/json; charset=utf-8",
        "X-Union-Appid": creds.appId,
      },
      body: JSON.stringify(payload),
    });
    const body = await res.text();
    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        body,
        error: `send group msg HTTP ${res.status}: ${body.slice(0, 200)}`,
      };
    }
    let id: string | undefined;
    try {
      const parsed = JSON.parse(body) as { id?: string };
      if (typeof parsed.id === "string" && parsed.id.length > 0) id = parsed.id;
    } catch {
      /* 允许非 JSON 成功体 */
    }
    if (id !== undefined) {
      return { ok: true, id, status: res.status, body };
    }
    return { ok: true, status: res.status, body };
  } catch (e) {
    return {
      ok: false,
      status: 0,
      body: "",
      error: (e as Error).message,
    };
  }
}

/**
 * 发送群聊文本（msg_type=0）。主动消息不带 msg_id。
 */
export async function sendGroupTextMessage(
  creds: QqOfficialCredentials,
  opts: SendGroupTextOptions,
  deps?: {
    tokenManager?: QqAccessTokenManager;
    fetchImpl?: FetchLike;
  }
): Promise<SendGroupTextResult> {
  const rich: SendGroupMessageOptions = {
    groupOpenid: opts.groupOpenid,
    msgType: 0,
    content: opts.content,
  };
  if (opts.msgId !== undefined) rich.msgId = opts.msgId;
  if (opts.msgSeq !== undefined) rich.msgSeq = opts.msgSeq;
  return sendGroupMessage(creds, rich, deps);
}

/**
 * 获取 Gateway WebSocket 地址。
 */
export async function fetchGatewayUrl(
  creds: QqOfficialCredentials,
  deps?: {
    tokenManager?: QqAccessTokenManager;
    fetchImpl?: FetchLike;
  }
): Promise<string> {
  const fetchImpl = deps?.fetchImpl ?? fetch;
  const tokenMgr =
    deps?.tokenManager ?? new QqAccessTokenManager(creds, fetchImpl);
  const auth = await tokenMgr.authorizationHeader();
  const base = resolveApiBase(creds.sandbox);
  const res = await fetchImpl(`${base}/gateway/bot`, {
    method: "GET",
    headers: {
      Authorization: auth,
      "X-Union-Appid": creds.appId,
    },
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`gateway/bot HTTP ${res.status}: ${text.slice(0, 200)}`);
  }
  let json: { url?: string };
  try {
    json = JSON.parse(text) as { url?: string };
  } catch {
    throw new Error(`gateway/bot 非 JSON: ${text.slice(0, 200)}`);
  }
  const url = String(json.url ?? "");
  if (!url) throw new Error(`gateway/bot 缺 url: ${text.slice(0, 200)}`);
  return url;
}

/** 去掉官方事件 content 前导 `<@!botid>` */
export function stripOfficialAtMention(content: string): string {
  let text = content.trim();
  if (text.startsWith("<@!")) {
    const idx = text.indexOf(">");
    if (idx >= 0) text = text.slice(idx + 1).trim();
  }
  return text;
}

// ── 通用 OpenAPI 请求（menu / panels / c2c 共用）────────────────

export type QqApiResult =
  | { ok: true; status: number; body: string; json?: unknown }
  | { ok: false; status: number; body: string; error: string };

async function authorizedApiRequest(
  creds: QqOfficialCredentials,
  opts: {
    method: string;
    path: string;
    body?: unknown;
  },
  deps?: {
    tokenManager?: QqAccessTokenManager;
    fetchImpl?: FetchLike;
  }
): Promise<QqApiResult> {
  const fetchImpl = deps?.fetchImpl ?? fetch;
  const tokenMgr = deps?.tokenManager ?? new QqAccessTokenManager(creds, fetchImpl);
  let auth: string;
  try {
    auth = await tokenMgr.authorizationHeader();
  } catch (e) {
    return { ok: false, status: 0, body: "", error: (e as Error).message };
  }
  const base = resolveApiBase(creds.sandbox);
  const url = `${base}${opts.path.startsWith("/") ? opts.path : `/${opts.path}`}`;
  try {
    const init: RequestInit = {
      method: opts.method,
      headers: {
        Authorization: auth,
        "Content-Type": "application/json; charset=utf-8",
        "X-Union-Appid": creds.appId,
      },
    };
    if (opts.body !== undefined) init.body = JSON.stringify(opts.body);
    const res = await fetchImpl(url, init);
    const body = await res.text();
    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        body,
        error: `${opts.method} ${opts.path} HTTP ${res.status}: ${body.slice(0, 200)}`,
      };
    }
    let json: unknown;
    try {
      json = JSON.parse(body) as unknown;
    } catch {
      /* 允许非 JSON */
    }
    return json !== undefined
      ? { ok: true, status: res.status, body, json }
      : { ok: true, status: res.status, body };
  } catch (e) {
    return { ok: false, status: 0, body: "", error: (e as Error).message };
  }
}

// ── 单聊消息 ──────────────────────────────────────────────────

export type SendC2cMessageOptions = {
  userOpenid: string;
  msgType?: 0 | 2;
  content?: string;
  markdown?: string;
  keyboardButtons?: QqKeyboardButton[];
  keyboardRows?: QqKeyboardButton[][];
  msgId?: string;
  msgSeq?: number;
};

/**
 * 发送单聊（C2C）消息。被动回复请带 msg_id。
 */
export async function sendC2cMessage(
  creds: QqOfficialCredentials,
  opts: SendC2cMessageOptions,
  deps?: {
    tokenManager?: QqAccessTokenManager;
    fetchImpl?: FetchLike;
  }
): Promise<SendGroupTextResult> {
  const markdown = opts.markdown?.trim();
  const msgType: 0 | 2 = opts.msgType ?? (markdown ? 2 : 0);
  const payload: Record<string, unknown> = { msg_type: msgType };
  if (msgType === 2) {
    payload.markdown = { content: markdown ?? "" };
  } else {
    payload.content = opts.content ?? "";
  }
  const keyboard = buildKeyboardPayload(opts);
  if (keyboard) payload.keyboard = keyboard;
  if (opts.msgId) {
    payload.msg_id = opts.msgId;
    if (opts.msgSeq !== undefined) payload.msg_seq = opts.msgSeq;
  }

  const res = await authorizedApiRequest(
    creds,
    {
      method: "POST",
      path: `/v2/users/${encodeURIComponent(opts.userOpenid)}/messages`,
      body: payload,
    },
    deps
  );
  if (!res.ok) {
    return { ok: false, status: res.status, body: res.body, error: res.error };
  }
  let id: string | undefined;
  if (res.json && typeof res.json === "object" && res.json !== null && "id" in res.json) {
    const maybe = (res.json as { id?: unknown }).id;
    if (typeof maybe === "string" && maybe.length > 0) id = maybe;
  }
  return id !== undefined
    ? { ok: true, id, status: res.status, body: res.body }
    : { ok: true, status: res.status, body: res.body };
}

// ── 自定义菜单（C2C 底栏）──────────────────────────────────────

/** 菜单项类型：发送消息 / 链接 / 子菜单 / 开关 */
export type QqMenuItemType = "send_message" | "link" | "menu" | "switch";

export type QqMenuItem = {
  type: QqMenuItemType;
  /** 按钮名称；中文约按 2 字符计，最多 10 字符 */
  name: string;
  /** type=send_message 时点击后填入输入框的文本 */
  send_message?: string;
  link?: string;
  /** type=menu 时的二级项（官方字段名 sub_menu_items） */
  sub_menu_items?: QqMenuItem[];
};

export type QqMenuPayload = {
  /** 官方要求包在 menu 下，PUT 会全量覆盖 */
  menu: {
    items: QqMenuItem[];
  };
};

/** GET /v2/menu */
export async function getMenu(
  creds: QqOfficialCredentials,
  deps?: { tokenManager?: QqAccessTokenManager; fetchImpl?: FetchLike }
): Promise<QqApiResult> {
  return authorizedApiRequest(creds, { method: "GET", path: "/v2/menu" }, deps);
}

/** PUT /v2/menu — 全量覆盖自定义菜单 */
export async function putMenu(
  creds: QqOfficialCredentials,
  menu: QqMenuPayload,
  deps?: { tokenManager?: QqAccessTokenManager; fetchImpl?: FetchLike }
): Promise<QqApiResult> {
  return authorizedApiRequest(creds, { method: "PUT", path: "/v2/menu", body: menu }, deps);
}

// ── 指令面板 ──────────────────────────────────────────────────

export type QqPanelItemType = "command" | "link";

/**
 * 面板元素。type=command 时点击后把 name 填入输入框（无单独 command 字段）。
 */
export type QqPanelItem = {
  type: QqPanelItemType;
  /** 展示名；command 时同时作为填入输入框的文本，最多约 14 字符 */
  name: string;
  /** 补充说明，最多约 30 字符 */
  desc?: string;
  link?: string;
  only_admin?: boolean;
};

export type QqPanelScope = "group" | "c2c" | "channel" | "dm";

export type QqPanelTargetType = "all" | "specific";

export type QqPanelConfig = {
  items?: QqPanelItem[];
  remark?: string;
  version?: number;
};

export type QqPanelCreateBody = {
  scope: QqPanelScope;
  target_type?: QqPanelTargetType;
  /** group + specific 时一次最多 20 个 */
  group_openids?: string[];
  /** c2c + specific 时一次最多 20 个 */
  user_openids?: string[];
  /** 必填：面板内容 */
  panel: QqPanelConfig;
};

export type QqPanelUpdateBody = {
  /** 必填：覆盖面板元素与备注 */
  panel: QqPanelConfig;
};

export type QqPanelTargetBody = {
  op: "add" | "del";
  group_openids?: string[];
  user_openids?: string[];
};

/** GET /v2/panels */
export async function listPanels(
  creds: QqOfficialCredentials,
  deps?: { tokenManager?: QqAccessTokenManager; fetchImpl?: FetchLike }
): Promise<QqApiResult> {
  return authorizedApiRequest(creds, { method: "GET", path: "/v2/panels" }, deps);
}

/** POST /v2/panels */
export async function createPanel(
  creds: QqOfficialCredentials,
  body: QqPanelCreateBody,
  deps?: { tokenManager?: QqAccessTokenManager; fetchImpl?: FetchLike }
): Promise<QqApiResult> {
  return authorizedApiRequest(creds, { method: "POST", path: "/v2/panels", body }, deps);
}

/** GET /v2/panels/{id} */
export async function getPanel(
  creds: QqOfficialCredentials,
  panelId: string,
  deps?: { tokenManager?: QqAccessTokenManager; fetchImpl?: FetchLike }
): Promise<QqApiResult> {
  return authorizedApiRequest(
    creds,
    { method: "GET", path: `/v2/panels/${encodeURIComponent(panelId)}` },
    deps
  );
}

/** PUT /v2/panels/{id} */
export async function updatePanel(
  creds: QqOfficialCredentials,
  panelId: string,
  body: QqPanelUpdateBody,
  deps?: { tokenManager?: QqAccessTokenManager; fetchImpl?: FetchLike }
): Promise<QqApiResult> {
  return authorizedApiRequest(
    creds,
    { method: "PUT", path: `/v2/panels/${encodeURIComponent(panelId)}`, body },
    deps
  );
}

/** DELETE /v2/panels/{id} */
export async function deletePanel(
  creds: QqOfficialCredentials,
  panelId: string,
  deps?: { tokenManager?: QqAccessTokenManager; fetchImpl?: FetchLike }
): Promise<QqApiResult> {
  return authorizedApiRequest(
    creds,
    { method: "DELETE", path: `/v2/panels/${encodeURIComponent(panelId)}` },
    deps
  );
}

/** PUT /v2/panels/{id}/target — 关联/取消群或用户 */
export async function updatePanelTarget(
  creds: QqOfficialCredentials,
  panelId: string,
  body: QqPanelTargetBody,
  deps?: { tokenManager?: QqAccessTokenManager; fetchImpl?: FetchLike }
): Promise<QqApiResult> {
  return authorizedApiRequest(
    creds,
    { method: "PUT", path: `/v2/panels/${encodeURIComponent(panelId)}/target`, body },
    deps
  );
}

// ── 群管理（只读 OpenAPI）──────────────────────────────────────

/** GET /v2/groups/{group_openid}/info — 可能需平台白名单（11253） */
export async function getGroupInfo(
  creds: QqOfficialCredentials,
  groupOpenid: string,
  deps?: { tokenManager?: QqAccessTokenManager; fetchImpl?: FetchLike }
): Promise<QqApiResult> {
  return authorizedApiRequest(
    creds,
    { method: "GET", path: `/v2/groups/${encodeURIComponent(groupOpenid)}/info` },
    deps
  );
}

/** GET /v2/groups/{group_openid}/bot_state — 机器人群内状态 */
export async function getGroupBotState(
  creds: QqOfficialCredentials,
  groupOpenid: string,
  deps?: { tokenManager?: QqAccessTokenManager; fetchImpl?: FetchLike }
): Promise<QqApiResult> {
  return authorizedApiRequest(
    creds,
    { method: "GET", path: `/v2/groups/${encodeURIComponent(groupOpenid)}/bot_state` },
    deps
  );
}

/**
 * PUT /interactions/{interaction_id} — 结束回调按钮 loading。
 * body 可空对象；失败不抛。
 */
export async function ackInteraction(
  creds: QqOfficialCredentials,
  interactionId: string,
  body: Record<string, unknown> = {},
  deps?: { tokenManager?: QqAccessTokenManager; fetchImpl?: FetchLike }
): Promise<QqApiResult> {
  return authorizedApiRequest(
    creds,
    {
      method: "PUT",
      path: `/interactions/${encodeURIComponent(interactionId)}`,
      body,
    },
    deps
  );
}

