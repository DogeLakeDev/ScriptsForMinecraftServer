/**
 * http.ts — 对 mp-gateway HTTP 接口的 JSON 请求
 *
 * 使用场景：core/auth.ts（微信登录）与 core/player-api.ts（玩家 / 设备授权接口）。
 * 网关错误统一为 { error } 信封，这里转换成带 HTTP 状态码的 Error，调用方按 status 区分处理（例如 401 重新登录）。
 */

/** 带 HTTP 状态码的请求异常；status 为 0 表示网络层失败 */
export interface HttpRequestError extends Error {
  status: number;
}

/** 一次 JSON 请求的参数 */
export interface JsonRequest {
  url: string;
  method: "GET" | "POST";
  data?: Record<string, unknown>;
  /** Authorization: Bearer 的值 */
  token?: string;
  timeout?: number;
}

/** 构造带状态码的异常 */
export function httpError(status: number, message: string): HttpRequestError {
  const error = new Error(message) as HttpRequestError;
  error.status = status;
  return error;
}

/** 发送 JSON 请求；非 2xx 时以网关返回的 error 文案（或兜底文案）抛出 HttpRequestError */
export function requestJson<T>(options: JsonRequest): Promise<T> {
  return new Promise((resolve, reject) => {
    wx.request({
      url: options.url,
      method: options.method,
      data: options.data,
      header: {
        "Content-Type": "application/json",
        ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      },
      timeout: options.timeout ?? 15_000,
      success: ({ statusCode, data }) => {
        if (statusCode >= 200 && statusCode < 300) {
          resolve(data as T);
          return;
        }
        const message = (data as { error?: unknown } | null)?.error;
        reject(httpError(statusCode, typeof message === "string" && message ? message : `请求失败（HTTP ${statusCode}）`));
      },
      fail: (error) => {
        const text = /domain list|合法域名/i.test(error.errMsg)
          ? "服务器域名未加入小程序 request 合法域名；开发阶段可在开发者工具中勾选“不校验合法域名”"
          : /timeout|超时/i.test(error.errMsg)
            ? "连接服务器超时，请检查网络"
            : error.errMsg || "无法连接服务器";
        reject(httpError(0, text));
      },
    });
  });
}
