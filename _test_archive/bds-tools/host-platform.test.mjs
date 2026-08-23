/**
 * host-platform 纯函数：Win / Linux 可执行文件名与 CDN 路径
 * 运行: npm test -w @sfmc-bds/bds-tools（需先 build）
 */
import assert from "node:assert/strict";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

const pkgRoot = path.dirname(fileURLToPath(import.meta.url));
const dist = path.join(pkgRoot, "dist", "host-platform.js");

async function loadHost() {
  return import(pathToFileURL(dist).href);
}

describe("host-platform", () => {
  it("exe 名按宿主 OS", async () => {
    const h = await loadHost();
    assert.equal(h.bdsExeName("windows"), "bedrock_server.exe");
    assert.equal(h.bdsExeName("linux"), "bedrock_server");
    assert.equal(h.bdsExePath("/opt/bds", "linux"), path.join("/opt/bds", "bedrock_server"));
  });

  it("详情 platform key 与 CDN suffix", async () => {
    const h = await loadHost();
    assert.equal(h.bdsDetailsPlatformKey("release", "windows"), "windows");
    assert.equal(h.bdsDetailsPlatformKey("preview", "windows"), "windows_preview");
    assert.equal(h.bdsDetailsPlatformKey("release", "linux"), "linux");
    assert.equal(h.bdsDetailsPlatformKey("preview", "linux"), "linux_preview");
    assert.equal(h.bdsCdnZipSuffix("release", "1.21.0.3", "windows"), "/bin-win/bedrock-server-1.21.0.3.zip");
    assert.equal(
      h.bdsCdnZipSuffix("preview", "1.21.0.3", "windows"),
      "/bin-win-preview/bedrock-server-1.21.0.3-preview.zip"
    );
    assert.equal(h.bdsCdnZipSuffix("release", "1.21.0.3", "linux"), "/bin-linux/bedrock-server-1.21.0.3.zip");
    assert.equal(
      h.bdsCdnZipSuffix("preview", "1.21.0.3", "linux"),
      "/bin-linux-preview/bedrock-server-1.21.0.3-preview.zip"
    );
  });

  it("Linux spawn env 含 LD_LIBRARY_PATH；Windows 为空", async () => {
    const h = await loadHost();
    assert.deepEqual(h.bdsSpawnEnvExtra("C:\\BDS", "windows"), {});
    const linux = h.bdsSpawnEnvExtra("/opt/bds", "linux");
    assert.ok(String(linux.LD_LIBRARY_PATH).startsWith("/opt/bds"));
  });

  it("完整性检查文件含平台 exe", async () => {
    const h = await loadHost();
    assert.deepEqual(h.bdsInstallRequiredFiles("windows"), ["bedrock_server.exe", "permissions.json"]);
    assert.deepEqual(h.bdsInstallRequiredFiles("linux"), ["bedrock_server", "permissions.json"]);
  });
});
