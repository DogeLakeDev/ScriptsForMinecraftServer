import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { formatDesktopVersion, parseDesktopVersion } from "../../management/src/protocol/desktop-version.ts";

export function desktopBuildInfo(version) {
  const parsed = parseDesktopVersion(version);
  if (!parsed || [...parsed.base.split(".").map(Number), parsed.build].some((value) => value > 65535))
    throw new Error("桌面版本或构建号无效");
  return {
    version,
    displayVersion: formatDesktopVersion(version),
    buildNumber: parsed.build,
    windowsVersion: `${parsed.base}.${parsed.build}`,
    tag: `${parsed.preview === undefined ? "desktop-v" : "desktop-preview-v"}${version}`,
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const pkg = JSON.parse(await fs.readFile(new URL("../package.json", import.meta.url), "utf8"));
  const info = desktopBuildInfo(pkg.version);
  if (process.argv[2] === "--check-tag" && process.argv[3] !== info.tag) throw new Error(`桌面标签应为 ${info.tag}`);
  console.log(JSON.stringify(info));
}
