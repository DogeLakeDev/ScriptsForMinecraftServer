/**
 * api.ts — 与 UI Studio 本地服务通信。
 *
 * 会话令牌随启动 URL（?token=）下发；此处转存 sessionStorage 并清理地址栏，
 * 之后所有 API 请求通过 Authorization 头携带，避免令牌出现在浏览器历史里。
 */

import type { UiStudioProjectSnapshot } from "../../src/ui-studio/project.js";

const params = new URLSearchParams(window.location.search);
const urlToken = params.get("token");
if (urlToken) {
  sessionStorage.setItem("ui-studio-token", urlToken);
  params.delete("token");
  const rest = params.toString();
  window.history.replaceState(
    null,
    "",
    window.location.pathname + (rest ? `?${rest}` : "") + window.location.hash,
  );
}

function token(): string {
  return sessionStorage.getItem("ui-studio-token") ?? "";
}

async function request<T>(pathname: string): Promise<T> {
  const response = await fetch(pathname, {
    headers: { authorization: `Bearer ${token()}` },
  });
  const body = (await response.json()) as T & { error?: string };
  if (!response.ok) {
    throw new Error(body.error ?? `请求失败（${response.status}）`);
  }
  return body;
}

/** 拉取工程快照（服务端每次重新读盘并编译）。 */
export function fetchProject(): Promise<UiStudioProjectSnapshot> {
  return request<UiStudioProjectSnapshot>("/api/project");
}
