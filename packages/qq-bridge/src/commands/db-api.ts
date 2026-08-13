/**
 * commands/db-api.ts — qq-bridge 调 db-server 平台 API（status / bind）
 */

import { request as httpRequest, type RequestOptions } from "node:http";

export type DbEndpoint = { host: string; port: number };

const TIMEOUT_MS = 5_000;

function requestJson<T>(
  ep: DbEndpoint,
  method: string,
  pathAndQuery: string,
  body?: unknown
): Promise<{ status: number; data: T }> {
  const payload = body === undefined ? undefined : JSON.stringify(body);
  const options: RequestOptions = {
    hostname: ep.host,
    port: ep.port,
    path: pathAndQuery,
    method,
    headers: {
      Accept: "application/json",
      ...(payload
        ? {
            "Content-Type": "application/json",
            "Content-Length": Buffer.byteLength(payload),
          }
        : {}),
    },
    timeout: TIMEOUT_MS,
  };
  return new Promise((resolve, reject) => {
    const req = httpRequest(options, (res) => {
      let buf = "";
      res.setEncoding("utf-8");
      res.on("data", (c: string) => {
        buf += c;
      });
      res.on("end", () => {
        const status = res.statusCode ?? 0;
        try {
          resolve({ status, data: JSON.parse(buf) as T });
        } catch {
          reject(new Error(`db-server 非 JSON (${status}): ${buf.slice(0, 120)}`));
        }
      });
    });
    req.on("timeout", () => req.destroy(new Error(`db-server 超时 ${TIMEOUT_MS}ms`)));
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

export type SfmcHostStatus = {
  hostname?: string;
  platform?: string;
  arch?: string;
  release?: string;
  uptimeSec?: number;
  uptimeText?: string;
  cpu?: { model?: string; cores?: number };
  memory?: { totalMb?: number; freeMb?: number; usedMb?: number; usedPercent?: number };
  loadavg?: [number, number, number];
};

export type SfmcProcessStatus = {
  pid?: number;
  running?: boolean;
  uptimeSec?: number | null;
  uptimeText?: string;
  state?: "running" | "stopped";
};

export type SfmcStatusResponse = {
  online?: Array<{ id?: string; name?: string }>;
  world?: { day?: number; difficulty?: string } | null;
  updatedAt?: number;
  note?: string;
  host?: SfmcHostStatus | null;
  processes?: {
    db?: SfmcProcessStatus;
    bds?: SfmcProcessStatus;
  } | null;
};

export async function fetchSfmcStatus(ep: DbEndpoint): Promise<SfmcStatusResponse> {
  const { data } = await requestJson<SfmcStatusResponse>(ep, "GET", "/api/sfmc/status");
  return data;
}

export type JoinRequestResponse = {
  success?: boolean;
  id?: string;
  player_name?: string;
  status?: string;
  auto_approved?: boolean;
  admin_notify?: boolean;
  note?: string;
  error?: string;
};

export async function postJoinRequest(
  ep: DbEndpoint,
  body: { openid: string; player_name: string; qq_backend: string }
): Promise<{ status: number; data: JoinRequestResponse }> {
  return requestJson(ep, "POST", "/api/sfmc/qq/join/request", body);
}

export type JoinSettingsResponse = {
  success?: boolean;
  allowlist_enabled?: boolean;
  require_approval?: boolean;
  treat_group_admins_as_admins?: boolean;
  error?: string;
  note?: string;
};

export async function fetchJoinSettings(ep: DbEndpoint): Promise<JoinSettingsResponse> {
  const { data } = await requestJson<JoinSettingsResponse>(ep, "GET", "/api/sfmc/qq/join/settings");
  return data;
}

export async function postJoinSettings(
  ep: DbEndpoint,
  body: {
    openid: string;
    as_group_admin?: boolean;
    allowlist_enabled?: boolean;
    require_approval?: boolean;
  }
): Promise<{ status: number; data: JoinSettingsResponse }> {
  return requestJson(ep, "POST", "/api/sfmc/qq/join/settings", body);
}

export type JoinDecideResponse = {
  success?: boolean;
  id?: string;
  status?: string;
  player_name?: string;
  applicant_openid?: string;
  error?: string;
};

export async function postJoinDecide(
  ep: DbEndpoint,
  body: {
    id: string;
    decision: "approve" | "reject";
    decided_by: string;
    as_group_admin?: boolean;
  }
): Promise<{ status: number; data: JoinDecideResponse }> {
  return requestJson(ep, "POST", "/api/sfmc/qq/join/decide", body);
}

export async function fetchJoinPending(
  ep: DbEndpoint,
  openid: string,
  asGroupAdmin = false
): Promise<{
  success?: boolean;
  pending?: Array<{ id?: string; player_name?: string; applicant_openid?: string }>;
  error?: string;
}> {
  const q =
    `/api/sfmc/qq/join/pending?openid=${encodeURIComponent(openid)}` +
    (asGroupAdmin ? "&as_group_admin=true" : "");
  const { data } = await requestJson(ep, "GET", q);
  return data;
}

export async function postAdminKick(
  ep: DbEndpoint,
  body: { openid: string; target_name: string; reason?: string; as_group_admin?: boolean }
): Promise<{ status: number; data: { success?: boolean; id?: string; error?: string } }> {
  return requestJson(ep, "POST", "/api/sfmc/qq/admin/kick", body);
}

export type BindMeResponse = {
  success?: boolean;
  bound?: boolean;
  binding?: {
    player_name?: string;
    player_xuid?: string;
    qq_user_openid?: string;
    bound_at?: number;
  } | null;
};

export async function fetchBindMe(ep: DbEndpoint, openid: string): Promise<BindMeResponse> {
  const q = `/api/sfmc/qq/bind/me?openid=${encodeURIComponent(openid)}`;
  const { data } = await requestJson<BindMeResponse>(ep, "GET", q);
  return data;
}

export type BindRequestResponse = {
  success?: boolean;
  code?: string;
  expires_at?: number;
  ttl_ms?: number;
  error?: string;
  player_name?: string;
};

export async function postBindRequest(
  ep: DbEndpoint,
  body: { openid: string; qq_backend: string }
): Promise<{ status: number; data: BindRequestResponse }> {
  return requestJson<BindRequestResponse>(ep, "POST", "/api/sfmc/qq/bind/request", body);
}

export type BindUnbindResponse = {
  success?: boolean;
  unbound?: boolean;
  error?: string;
};

export async function postBindUnbind(
  ep: DbEndpoint,
  body: { openid: string }
): Promise<{ status: number; data: BindUnbindResponse }> {
  return requestJson<BindUnbindResponse>(ep, "POST", "/api/sfmc/qq/bind/unbind", body);
}
