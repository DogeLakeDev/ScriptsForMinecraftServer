/**
 * 校验幂等键格式是否合法（仅允许 1~128 位的字母、数字及 `_.:-` 字符）。
 *
 * @param key 待校验的幂等键。
 * @returns 格式合法返回 `true`，否则返回 `false`。
 */
export function isValidIdempotencyKey(key: string): boolean {

  if (!key || typeof key !== "string") return false;
  const trimmed = key.trim();
  return trimmed.length > 0 && /^[A-Za-z0-9_.:-]{1,128}$/.test(trimmed);
}
