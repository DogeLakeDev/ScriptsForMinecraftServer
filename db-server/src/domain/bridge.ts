type QQBridgeConfig = {
  host: string;
  port: number;
};

/**
 * @description
 * @author Shiroha7z
 * @date 17/07/2026
 * @export
 * @param {QQBridgeConfig} [config={ host: "127.0.0.1", port: 3003 }]
 * @param {string} channelId
 * @param {string} fromName
 * @param {string} content
 * @param {string} fromId
 */
export function forwardToQQBridge(
  config: QQBridgeConfig = { host: "127.0.0.1", port: 3003 },
  channelId: string,
  fromName: string,
  content: string,
  fromId: string
): void {
  const payload = JSON.stringify({ channelId, fromName, content, fromId });
  const url = `http://${config.host}:${config.port}/forward`;
  fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: payload,
  })
    .then(async (res: Response) => {
      if (res.status !== 200) {
        const body = await res.text();
        return console.warn(`[DogeDB] QQ Bridge forward → ${res.status}: ${String(body).slice(0, 100)}`);
      }
      return Promise.resolve();
    })
    .catch((err) => console.warn(`[DogeDB] QQ Bridge 不可达: ${err.message}`));
}

