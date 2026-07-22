/**
 * HTTP 业务信封判定(无 Minecraft 依赖,可单测)。
 *
 * 服务端历史混用 `ok` / `success` 方言;客户端必须以同一契约认失败,
 * 否则 HTTP 200 + `{ success: false }` 会被误判为成功(LSP)。
 */

export type HttpEnvelopeFields = {
  ok?: unknown;
  success?: unknown;
  error?: unknown;
};

/** status===200 且未显式声明失败时视为成功。 */
export function isSuccessfulHttpEnvelope(status: number, parsed: HttpEnvelopeFields): boolean {
  if (status !== 200) return false;
  if (parsed.ok === false) return false;
  if (parsed.success === false) return false;
  return true;
}
