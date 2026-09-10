export interface BdsPlayerSession {
  connected: boolean;
  playerName: string;
  xuid: string;
}

/** 从 BDS 原生日志中提取玩家名与 XUID。 */
export function parseBdsPlayerSession(line: string): BdsPlayerSession | null {
  const match = /Player (connected|disconnected):\s*([^,]+),\s*xuid:\s*([^\s]+)/i.exec(line);
  if (!match) return null;
  const playerName = match[2]?.trim() ?? "";
  const xuid = match[3]?.trim() ?? "";
  if (!playerName || !xuid) return null;
  return { connected: match[1]?.toLowerCase() === "connected", playerName, xuid };
}

/** 将玩家会话身份异步同步到本机 db-server。 */
export function reportBdsPlayerSession(line: string, options: { port: number; authToken?: string }): void {
  const session = parseBdsPlayerSession(line);
  if (!session) return;
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (options.authToken) headers.authorization = `Bearer ${options.authToken}`;
  void fetch(`http://127.0.0.1:${options.port}/api/sfmc/player-session`, {
    method: "POST",
    headers,
    body: JSON.stringify(session),
    signal: AbortSignal.timeout(2_000),
  }).catch(() => {
    // 身份同步失败不应干扰 BDS 日志管道；后续连接或低频校验会重试。
  });
}
