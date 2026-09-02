/**
 * http-envelope.ts — HTTP 业务响应信封校验（无 Minecraft 依赖，支持隔离单元测试）
 *
 * 统一收敛对服务端响应体中 `ok` 与 `success` 标识的兼容判定，
 * 避免在 HTTP 200 状态码下服务端返回 `{ success: false }` 时被客户端误判为成功。
 */

/** HTTP 响应信封字段声明。 */
export type HttpEnvelopeFields = {
  ok?: unknown;
  success?: unknown;
  error?: unknown;
};

/**
 * 判断 HTTP 响应是否符合业务成功信封规范。
 *
 * @param status HTTP 状态码（必须为 200）。
 * @param parsed 已解析的 JSON 响应体。
 * @returns 仅当 HTTP 状态码为 200 且 `ok` 与 `success` 均未显式声明为 `false` 时返回 `true`。
 */
export function isSuccessfulHttpEnvelope(status: number, parsed: HttpEnvelopeFields): boolean {
  if (status !== 200) return false;
  if (parsed.ok === false) return false;
  if (parsed.success === false) return false;
  return true;
}

