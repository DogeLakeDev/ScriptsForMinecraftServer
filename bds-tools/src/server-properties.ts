/**
 * server.properties 辅助：安装/启动时确保 emit-server-telemetry=true
 */
import fs from "node:fs";
import path from "node:path";

export const EMIT_SERVER_TELEMETRY_KEY = "emit-server-telemetry";
export const EMIT_SERVER_TELEMETRY_LINE = "emit-server-telemetry=true";

export type ServerPropertiesLogger = {
  info: (msg: string) => void;
};

/**
 * 若 `<bdsRoot>/server.properties` 中尚无 emit-server-telemetry，则追加 `=true`。
 * 已有该键（任意值）则跳过。文件不存在时跳过（BDS 尚未解压）。
 * @returns true = 本次新追加；false = 跳过
 */
export function ensureEmitServerTelemetry(
  bdsRoot: string,
  logger?: ServerPropertiesLogger
): boolean {
  const file = path.join(bdsRoot, "server.properties");
  if (!fs.existsSync(file)) return false;

  let text = fs.readFileSync(file, "utf8");
  if (/^\s*emit-server-telemetry\s*=/im.test(text)) {
    return false;
  }

  if (text.length > 0 && !text.endsWith("\n")) {
    text += "\n";
  }
  text += `${EMIT_SERVER_TELEMETRY_LINE}\n`;
  fs.writeFileSync(file, text, "utf8");

  logger?.info(
    "已向 server.properties 追加 emit-server-telemetry=true（因您已同意 Mojang EULA，按协议启用服务器遥测）"
  );
  return true;
}
