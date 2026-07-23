/**
 * check-update.ts — BDS 自动更新器 (主流程)
 *
 *   1. 临时 staging 目录 (mkdtempSync) - 避免污染 SCRIPT_DIR
 *   2. 下载/解压失败 → 自动从备份回滚 preserves
 *   3. 流式 SHA256 校验 - 不把 250MB 文件读入内存
 *   4. 兼容版本白名单 - 不匹配则跳过升级
 *   5. QQ 通知统一加 5s 超时 - 永远不阻塞主流程
 *   6. Rollback marker 落盘 - 跨进程 / 跨重启可恢复
 */

import { createFileSink, createLogger, createStdoutSink } from "@sfmc-bds/sdk/logs";
import cliProgress from "cli-progress";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createBdsManager } from "./bds-manager.js";
import { CHANGELOG_BASE, fetchChangelog } from "./changelog.js";
import { copyDirSync, emptyDirSync, hashFileAsync, rmSafe } from "./fsx.js";
import { httpDownload } from "./http.js";
import { isMainModule } from "./is-main.js";
import { loadConfig, LOG_PATH, resolvePaths } from "./paths.js";
import { sendText, sendWithImage } from "./qqutil.js";
import {
  clearRollbackMarker,
  getDirSize,
  rollbackFromBackup,
  verifyBdsInstall,
  writeRollbackMarker,
} from "./rollback.js";
import { ensureEmitServerTelemetry } from "./server-properties.js";
import { clearTaskbarProgress, isTaskbarSupported, setTaskbarProgress } from "./taskbar.js";
import {
  buildDownloadUrls,
  fetchVersionDetails,
  getVersionInfo,
  isVersionCompatible,
  verifyFileHash,
} from "./upstream.js";
import { compareVersions, getCurrentVersionAsync, getCurrentVersionSync, saveVersionCache } from "./version.js";
import { extractZipFileToDir } from "./zipx.js";

// 独立入口:source = "updater",与 bds-manager 的 "bds-tools" 区分
const updaterFileSink = createFileSink(LOG_PATH);
const log = createLogger({ source: "updater", sinks: [createStdoutSink({ bare: true }), updaterFileSink] });
const closeLog = (): void => updaterFileSink.close();

function parseArgs(argv: string[]): Record<string, string | boolean> {
  const out: Record<string, string | boolean> = {};
  for (const a of argv) {
    const m = a.match(/^--([\w-]+)(?:=(.+))?$/);
    if (m) out[m[1]!] = m[2] || true;
  }
  return out;
}

interface UpdateContext {
  cfg: ReturnType<typeof loadConfig>;
  channel: "release" | "preview" | string;
  checkOnly: boolean;
  force: boolean;
  bdsPath: string;
  backupDir: string;
  preserve: string[];
  autoRestart: boolean;
  qqNotify: boolean;
}

function buildContext(): UpdateContext {
  const cfg = loadConfig();
  const args = parseArgs(process.argv.slice(2));
  const { bds_path, backup_dir, preserve } = resolvePaths(cfg);
  const channel = String(args["channel"] || cfg.channel || "release");
  return {
    cfg,
    channel,
    checkOnly: !!args["check-only"],
    force: !!args["force"],
    bdsPath: bds_path,
    backupDir: backup_dir,
    preserve,
    autoRestart: !args["no-start"] && cfg.auto_restart !== false,
    qqNotify: !!cfg.qq_notify,
  };
}

async function doBackup(
  bdsPath: string,
  backupDir: string,
  preserve: string[]
): Promise<{ path: string; size: number }> {
  const dateStr = new Date().toISOString().slice(0, 10);
  const dest = path.join(backupDir, dateStr);
  fs.mkdirSync(dest, { recursive: true });

  let anyCopied = false;
  for (const item of preserve) {
    const src = path.join(bdsPath, item);
    const target = path.join(dest, item);
    if (!fs.existsSync(src)) continue;
    fs.mkdirSync(path.dirname(target), { recursive: true });
    if (fs.statSync(src).isDirectory()) copyDirSync(src, target);
    else fs.copyFileSync(src, target);
    anyCopied = true;
    log.info(`已备份: ${item}`);
  }

  // 即使全部 preserve 都跳过，也让目录存在以便记录时间戳
  if (!anyCopied) {
    log.info(`没有需要备份的文件 (preserve 列表为空或全部缺失)`);
  }
  return { path: dest, size: getDirSize(dest) };
}

/** 异步恢复 preserves 从备份到 BDS 路径 */
async function restorePreserves(bdsPath: string, backupDir: string, preserve: string[]): Promise<void> {
  for (const item of preserve) {
    const src = path.join(backupDir, item);
    const dest = path.join(bdsPath, item);
    if (!fs.existsSync(src)) continue;
    try {
      if (fs.statSync(src).isDirectory()) {
        if (fs.existsSync(dest)) emptyDirSync(dest);
        copyDirSync(src, dest);
      } else {
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.copyFileSync(src, dest);
      }
      log.info(`已恢复: ${item}`);
    } catch (e) {
      log.warn(`恢复失败 ${item}: ${(e as Error).message}`);
    }
  }
}

/** 把 srcDir 下的内容移动到 destDir (覆盖) — 经 zipx 安全解压 */
async function extractZipToBds(zipPath: string, destDir: string): Promise<void> {
  // 抽出到临时目录，避免旧内容干扰
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "bds-extract-"));
  try {
    await extractZipFileToDir(zipPath, tmpDir);
    // 把临时目录里的内容复制到 BDS 路径
    for (const entry of fs.readdirSync(tmpDir)) {
      const srcPath = path.join(tmpDir, entry);
      const destPath = path.join(destDir, entry);
      if (fs.statSync(srcPath).isDirectory()) {
        if (fs.existsSync(destPath)) emptyDirSync(destPath);
        copyDirSync(srcPath, destPath);
      } else {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  } finally {
    rmSafe(tmpDir);
  }
}

export async function runUpdate(): Promise<number> {
  const startTime = Date.now();
  const ctx = buildContext();
  const { cfg, channel, checkOnly, force, bdsPath, backupDir, preserve, autoRestart, qqNotify } = ctx;

  log.info(`===== 开始检查更新 (${channel}) =====`);
  fs.mkdirSync(bdsPath, { recursive: true });
  fs.mkdirSync(backupDir, { recursive: true });

  // 1. 当前版本
  const exePath = path.join(bdsPath, "bedrock_server.exe");
  const currentVer = await getCurrentVersionAsync(exePath).catch(() => getCurrentVersionSync(exePath));
  log.info(`当前版本: ${currentVer}`);

  // 2. 获取最新版本
  let latestVer: string;
  try {
    const info = await getVersionInfo(cfg, channel);
    latestVer = info.version;
    log.info(`最新版本: ${latestVer}`);
    const cmp = compareVersions(latestVer, currentVer);
    if (cmp <= 0 && !force) {
      log.info("已是最新版本，无需更新");
      if (qqNotify) {
        await sendText(`✅ BDS 已是最新版本\n\n当前: ${currentVer}\n最新: ${latestVer}`);
      }
      console.log(`CURRENT=${currentVer}`);
      console.log(`LATEST=${latestVer}`);
      console.log("SFMC_UPDATE_RESULT=uptodate");
      return 0;
    }
  } catch (e) {
    log.error(`获取版本信息失败: ${(e as Error).message}`);
    await sendText(`❌ BDS 更新失败\n\n无法获取版本信息: ${(e as Error).message}`);
    return 1;
  }

  // 兼容性检查
  if (!force && !isVersionCompatible(cfg, latestVer)) {
    log.warn(`${latestVer} 不在兼容版本白名单中，跳过升级`);
    if (qqNotify) {
      await sendText(`⚠️ BDS ${latestVer} 不在兼容性白名单，已跳过升级。请人工确认。`);
    }
    console.log("SFMC_UPDATE_RESULT=skipped");
    return 2;
  }

  // 3. 取下载链接
  let downloadUrls: string[];
  let hash: { sha1: string; sha256: string };
  try {
    const details = await fetchVersionDetails(cfg, channel, latestVer);
    downloadUrls = buildDownloadUrls(cfg, channel, latestVer, details);
    hash = { sha1: details.sha1, sha256: details.sha256 };
  } catch (e) {
    log.error(`获取下载详情失败: ${(e as Error).message}`);
    await sendText(`❌ BDS 更新失败\n\n下载详情获取失败: ${(e as Error).message}`);
    return 1;
  }

  if (checkOnly) {
    console.log(`CURRENT=${currentVer}`);
    console.log(`LATEST=${latestVer}`);
    console.log(`CHANNEL=${channel}`);
    console.log(`URLS=${downloadUrls.length}`);
    console.log("SFMC_UPDATE_RESULT=check-only");
    return 0;
  }

  log.info(`发现新版本: ${currentVer} → ${latestVer}`);

  // 4. QQ 预告
  if (qqNotify) {
    await sendText(
      `𝐌𝐢𝐧𝐞𝐜𝐫𝐚𝐟𝐭 𝐁𝐃𝐒 更新通知\n\n` +
        `检测到新版本！\n\n` +
        `当前: ${currentVer}\n` +
        `最新: ${latestVer}\n` +
        `频道: ${channel === "preview" ? "预览版" : "正式版"}\n\n` +
        `服务器即将开始更新~ 请耐心等待^(*￣(oo)￣)^`
    );
    const cl = await fetchChangelog(channel);
    if (cl) {
      const text = `📋 更新内容概要\n\n${cl.text.slice(0, 1500)}\n\n完整日志: ${CHANGELOG_BASE}`;
      if (cl.imageBase64) await sendWithImage(text, cl.imageBase64);
      else await sendText(text);
    } else {
      await sendText(`📋 更新日志: ${CHANGELOG_BASE}`);
    }
  }

  // 5. 备份
  let backupInfo: { path: string; size: number };
  try {
    backupInfo = await doBackup(bdsPath, backupDir, preserve);
    log.info(`备份完成: ${backupInfo.path} (${(backupInfo.size / 1024 / 1024).toFixed(1)} MB)`);
    if (qqNotify) {
      await sendText(`✅ 备份完成\n\n大小: ${(backupInfo.size / 1024 / 1024).toFixed(1)} MB\n位置: ${backupInfo.path}`);
    }
  } catch (e) {
    log.error(`备份失败: ${(e as Error).message}`);
    await sendText(`❌ BDS 更新失败\n\n备份失败: ${(e as Error).message}\n操作已中止`);
    return 1;
  }

  // 6. 写回滚标记 (跨进程可恢复)
  writeRollbackMarker({
    timestamp: Date.now(),
    bds_path: bdsPath,
    backup_dir: backupInfo.path,
    preserve,
    previous_version: currentVer,
  });

  // 7. 停服
  const bds = createBdsManager({ detached: true });
  try {
    log.info("停止 BDS 服务...");
    await bds.stop();
    log.info("BDS 已停止");
  } catch (e) {
    log.warn(`BDS 停止异常: ${(e as Error).message}`);
  }

  // 8. 下载 (全部失败则回滚)
  // 用 mkdtempSync 创建临时 staging 目录 - 避免污染 SCRIPT_DIR
  const stagingDir = fs.mkdtempSync(path.join(os.tmpdir(), "bds-update-"));
  const zipPath = path.join(stagingDir, `bedrock-server-${latestVer}.zip`);
  let downloaded = false;
  try {
    log.info(`开始下载 ${latestVer}...`);
    if (qqNotify) await sendText(`📥 正在下载 BDS ${latestVer}...`);

    let lastErr: Error | null = null;
    const downloadTimeoutMs = (cfg.download_timeout ?? 120) * 1000;
    /* stderr 被 pipe 时 cli-progress 默认不画；用文本进度给 sfmc REPL 等父进程 */
    const useProgressBar = !!process.stderr.isTTY;
    const progressBar = useProgressBar
      ? new cliProgress.SingleBar(
          {
            format: "下载进度 | {bar} | {percentage}% | {value}/{total} MB | 速度: {speed}",
            barCompleteChar: "\u2588",
            barIncompleteChar: "\u2591",
            hideCursor: true,
            clearOnComplete: false, // 保留进度条
          },
          cliProgress.Presets.shades_classic
        )
      : null;

    let lastTime = Date.now();
    let lastLoaded = 0;
    let barStarted = false; // 标记是否已启动
    let lastLoggedPct = -1;
    if (isTaskbarSupported() && process.stdout.isTTY) {
      log.info("检测到 Windows Terminal,任务栏进度已启用 (OSC 9;4)");
    }
    for (const url of downloadUrls) {
      try {
        await httpDownload(url, zipPath, {
          totalTimeoutMs: Math.max(downloadTimeoutMs, 600_000), // 不少于 10 分钟
          onProgress: (dl, total) => {
            const now = Date.now();
            const timeDelta = (now - lastTime) / 1000; // 秒
            const bytesDelta = dl - lastLoaded;
            const speed = timeDelta > 0 ? bytesDelta / timeDelta : 0;
            const speedStr =
              speed > 1024 * 1024
                ? `${(speed / 1024 / 1024).toFixed(1)} MB/s`
                : speed > 1024
                  ? `${(speed / 1024).toFixed(1)} KB/s`
                  : `${speed.toFixed(0)} B/s`;
            const totalMb = total > 0 ? total / (1024 * 1024) : 0;
            const dlMb = dl / (1024 * 1024);
            const pct = total > 0 ? (dl / total) * 100 : 0;

            if (progressBar) {
              if (!barStarted) {
                progressBar.start(totalMb || 1, 0, { speed: "0 KB/s" });
                barStarted = true;
                setTaskbarProgress(0);
              }
              progressBar.update(dlMb, { speed: speedStr });
            } else {
              const stepped = Math.floor(pct / 5) * 5;
              if (stepped !== lastLoggedPct && (stepped > lastLoggedPct || pct >= 100)) {
                lastLoggedPct = stepped;
                log.info(
                  `下载进度 ${Math.min(100, Math.round(pct))}% (${dlMb.toFixed(1)}/${totalMb.toFixed(1)} MB) ${speedStr}`
                );
              }
            }
            setTaskbarProgress(pct);
            lastLoaded = dl;
            lastTime = now;
          },
        });
        if (progressBar && barStarted) progressBar.stop();
        // 下载完成,任务栏收到 100% 绿条后清掉
        setTaskbarProgress(100);
        clearTaskbarProgress();
        downloaded = true;
        lastErr = null;
        break;
      } catch (e) {
        if (progressBar && barStarted) progressBar.stop();
        barStarted = false;
        lastLoggedPct = -1;
        // 下载失败,任务栏亮红
        setTaskbarProgress(100, "error");
        clearTaskbarProgress();
        lastErr = e as Error;
        log.warn(`${url} 不可用: ${lastErr.message}，尝试备用地址...`);
      }
    }
    if (!downloaded && lastErr) throw lastErr;

    const zipSizeMB = (fs.statSync(zipPath).size / 1024 / 1024).toFixed(1);
    log.info(`下载完成 (${zipSizeMB} MB)`);

    // 流式哈希校验
    if (hash.sha1 || hash.sha256) {
      const algo = hash.sha256 ? "SHA256" : "SHA1";
      log.info(`校验文件完整性 (${algo})...`);
      const ok = await verifyFileHash(zipPath, hash.sha1, hash.sha256);
      if (!ok) throw new Error(`${algo} 校验不通过，文件可能损坏`);
      log.info(`${algo} 校验通过`);
    }
  } catch (e) {
    log.error(`下载失败: ${(e as Error).message}`);
    await sendText(`❌ BDS 更新失败\n\n下载失败: ${(e as Error).message}\nBDS 已停止，请手动恢复`);
    // 自动回滚
    rollbackFromBackup({
      timestamp: Date.now(),
      bds_path: bdsPath,
      backup_dir: backupInfo.path,
      preserve,
      previous_version: currentVer,
    });
    rmSafe(stagingDir);
    return 1;
  }

  // 9. 解压 + 部署
  try {
    log.info("解压中...");
    // 先清空 BDS 目录
    emptyDirSync(bdsPath);
    await extractZipToBds(zipPath, bdsPath);
    log.info("解压完成");
  } catch (e) {
    log.error(`解压失败: ${(e as Error).message}`);
    await sendText(`❌ BDS 更新失败\n\n解压失败: ${(e as Error).message}\nBDS 已停止，请手动恢复`);
    // 回滚: 清空 + 从备份恢复 preserves
    emptyDirSync(bdsPath);
    await restorePreserves(bdsPath, backupInfo.path, preserve);
    rmSafe(stagingDir);
    return 1;
  } finally {
    rmSafe(zipPath); // 清掉 staging zip
  }

  // 10. 完整性检查 (避免解压出空/缺文件的病态包)
  const verify = verifyBdsInstall(bdsPath, [
    "bedrock_server.exe",
    /*"bedrock_server_symbols.debug",*/ "permissions.json",
  ]);
  if (!verify.ok) {
    log.error(`解压后的 BDS 不完整，缺失文件: ${verify.missing.join(", ")}`);
    await sendText(`❌ BDS 更新失败\n\n部署后缺失关键文件: ${verify.missing.join(", ")}`);
    emptyDirSync(bdsPath);
    await restorePreserves(bdsPath, backupInfo.path, preserve);
    rmSafe(stagingDir);
    return 1;
  }

  // 11. 恢复 preserves (zip 解压时这些目录可能被覆盖)
  await restorePreserves(bdsPath, backupInfo.path, preserve);

  // 11b. 安装收尾：因 EULA 已同意，确保遥测开关（已有则跳过）
  ensureEmitServerTelemetry(bdsPath, log);

  // 12. 写入版本缓存
  const newExeHash = await hashFileAsync(exePath, "sha256").catch(() => "");
  if (newExeHash) {
    saveVersionCache(latestVer, newExeHash);
    log.info(`已记录版本 ${latestVer} 的 SHA256`);
  }

  // 13. 启动 BDS
  if (autoRestart) {
    try {
      log.info("启动 BDS...");
      await bds.start();
    } catch (e) {
      log.error(`启动失败: ${(e as Error).message}`);
      await sendText(`❌ BDS 更新失败\n\n启动失败: ${(e as Error).message}\n请手动启动 BDS`);
      // 注意: 此时 BDS 已经部署完成，启动失败 → 启动问题，不做文件级回滚
      rmSafe(stagingDir);
      clearRollbackMarker();
      return 1;
    }
  }

  rmSafe(stagingDir);
  clearRollbackMarker();

  // 14. QQ 通知结果
  const durationMs = Date.now() - startTime;
  if (qqNotify) {
    await sendText(
      `✅ BDS 更新完成\n\n` +
        `${currentVer} → ${latestVer}\n` +
        `耗时: ${(durationMs / 1000).toFixed(1)}s\n` +
        `${autoRestart ? "服务器已重新启动" : "请手动重启服务器"}`
    );
  }
  log.info(`===== 更新完成 (${(durationMs / 1000).toFixed(1)}s) =====`);
  /* 机器可读结果标记：供 sfmc 等监督器判断「真正完成部署」，勿依赖本地化日志文案。 */
  console.log("SFMC_UPDATE_RESULT=deployed");
  return 0;
}

function isMain(): boolean {
  // sfmc supervisor 通过 SFMC_SERVICE 拉起子进程时优先判定
  if (process.env.SFMC_SERVICE === "update") return true;
  return isMainModule(import.meta.url);
}

if (isMain()) {
  runUpdate()
    .then((code) => {
      closeLog();
      process.exit(code);
    })
    .catch((e) => {
      log.error(`未捕获错误: ${(e as Error).message}`);
      closeLog();
      process.exit(1);
    });
}
