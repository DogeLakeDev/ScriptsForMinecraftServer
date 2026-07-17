/**
 * 验证幂等键格式
 *
 * @export
 * @param {string} key
 * @return {*}  {(boolean | string)}
 */
export function isValidIdempotencyKey(key: string): boolean {
  if (!key || typeof key !== "string") return false;
  const trimmed = key.trim();
  return trimmed.length > 0 && /^[A-Za-z0-9_.:-]{1,128}$/.test(trimmed);
}
