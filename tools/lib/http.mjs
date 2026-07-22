/**
 * tools/lib/http.mjs — 轻量 HTTP JSON 客户端(供 smoke / ootb)
 */
import http from "node:http";

/**
 * @param {object} opts
 * @param {string} [opts.host]
 * @param {number} opts.port
 * @param {string} opts.method
 * @param {string} opts.path
 * @param {unknown} [opts.body]
 * @param {number} [opts.timeout]
 */
export function requestJson({ host = "127.0.0.1", port, method, path: urlPath, body, timeout = 4000 }) {
  return new Promise((resolve, reject) => {
    const data = body === undefined ? null : JSON.stringify(body);
    const headers = {};
    if (data) {
      headers["Content-Type"] = "application/json";
      headers["Content-Length"] = Buffer.byteLength(data);
    }
    const req = http.request(
      { hostname: host, port, path: urlPath, method, headers, timeout },
      (res) => {
        let text = "";
        res.setEncoding("utf8");
        res.on("data", (c) => (text += c));
        res.on("end", () => {
          let parsed = text;
          try {
            parsed = text ? JSON.parse(text) : {};
          } catch {
            /* keep raw */
          }
          resolve({ status: res.statusCode, body: parsed });
        });
      }
    );
    req.on("error", reject);
    req.on("timeout", () => req.destroy(new Error("timeout")));
    if (data) req.write(data);
    req.end();
  });
}

/**
 * @param {number} port
 * @param {number} [timeoutMs]
 * @param {string} [healthPath]
 */
export async function waitHealth(port, timeoutMs = 15000, healthPath = "/api/health") {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const r = await requestJson({ port, method: "GET", path: healthPath, timeout: 500 });
      if (r.status === 200) return true;
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  return false;
}
