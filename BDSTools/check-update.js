#!/usr/bin/env node

/**
 * check-update — BDS 自动更新器
 *
 * 检查 Minecraft Bedrock Dedicated Server 官方更新，自动下载、备份、更新。
 *
 * 用法:
 *   node check-update.js                      默认 release
 *   node check-update.js --channel=preview    预览版
 *   node check-update.js --check-only         仅检查
 *   node check-update.js --force              强制重装
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { assertNodeVersion } = require('../db-server/lib/runtime');
if (!assertNodeVersion(18, 0)) process.exit(2);
let AdmZip;
try {
  AdmZip = require('adm-zip');
} catch (error) {
  console.error(`[BDSUpdater] 缺少依赖 adm-zip，请在 BDSTools 目录执行 npm install: ${error.message}`);
  process.exit(1);
}
const bds = require('./bds-manager');

// ────────── 配置 ──────────

const SCRIPT_DIR = __dirname;
const ROOT_DIR = path.resolve(SCRIPT_DIR, '..');
const CFG_PATH = path.join(ROOT_DIR, 'configs', 'bds_updater.json');
const LOG_PATH = path.join(SCRIPT_DIR, 'update.log');
const QQ_SENDER = path.join(SCRIPT_DIR, 'llbot-sender.js');

let cfg;
try {
  cfg = JSON.parse(fs.readFileSync(CFG_PATH, 'utf-8'));
} catch (e) {
  console.error(`[BDSUpdater] 无法读取配置: ${e.message}`);
  process.exit(1);
}

// ── 命令行参数 ──
const args = {};
for (const a of process.argv.slice(2)) {
  const m = a.match(/^--([\w-]+)(?:=(.+))?$/);
  if (m) args[m[1]] = m[2] || true;
}
const CHANNEL = args.channel || cfg.channel || 'release';
const CHECK_ONLY = !!args['check-only'];
const FORCE = !!args.force;
const BDS_PATH = path.resolve(cfg.bds_path || process.cwd());
const BACKUP_DIR = path.resolve(cfg.backup_dir || path.join(BDS_PATH, '..', 'backups'));
const AUTO_RESTART = cfg.auto_restart !== false;

const RELEASE_URL = 'https://www.minecraft.net/en-us/download/server/bedrock';
const PREVIEW_URL = 'https://www.minecraft.net/en-us/download/server/bedrock-preview';
const VERSION_MODE = cfg.version_mode || 'bedrock-oss';
const VERSIONS_API = cfg.version_versions || 'https://raw.githubusercontent.com/Bedrock-OSS/BDS-Versions/main/versions.json';
const VERSIONS_MIRROR = cfg.version_versions_mirror || 'https://cdn.jsdelivr.net/gh/Bedrock-OSS/BDS-Versions@main/versions.json';
const DETAILS_API = cfg.version_details || 'https://raw.githubusercontent.com/Bedrock-OSS/BDS-Versions/main/{platform}/{version}.json';
const DETAILS_MIRROR = cfg.version_details_mirror || 'https://cdn.jsdelivr.net/gh/Bedrock-OSS/BDS-Versions@main/{platform}/{version}.json';
const CHANGELOG_BASE = 'https://feedback.minecraft.net/hc/en-us/sections/360001186971';
const DOWNLOAD_TIMEOUT = (cfg.download_timeout || 120) * 1000;
const FETCH_TIMEOUT = 15000;
const DOWNLOAD_MIRROR = cfg.download_mirror || '';

/** 版本号 4段 → 3段（去尾）: 1.26.33.2 → 1.26.33 */
function toVer3(v) { return v.split('.').slice(0, 3).join('.'); }

/** 版本号 3段 → 4段（补0）: 1.26.33 → 1.26.33.0 */
function toVer4(v) { const p = v.split('.'); while (p.length < 4) p.push('0'); return p.join('.'); }

/** 模板替换: {version} {ver3} {platform} {channel} */
function resolveTemplate(tpl, vars) {
  let s = tpl;
  for (const [k, v] of Object.entries(vars)) s = s.replace(new RegExp(`\\{${k}\\}`, 'g'), v);
  return s;
}

// ────────── 日志 ──────────

function log(msg) {
  const ts = new Date().toISOString().replace('T', ' ').slice(0, 19);
  const line = `[${ts}] ${msg}`;
  console.log(line);
  try { fs.appendFileSync(LOG_PATH, line + '\n'); } catch {}
}

function logError(msg) {
  const ts = new Date().toISOString().replace('T', ' ').slice(0, 19);
  const line = `[${ts}] [ERROR] ${msg}`;
  console.error(line);
  try { fs.appendFileSync(LOG_PATH, line + '\n'); } catch {}
}

// ────────── HTTP 工具 ──────────

function httpGet(url, timeout = FETCH_TIMEOUT) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const u = new URL(url);
    const req = mod.request({
      hostname: u.hostname,
      port: u.port || 443,
      path: u.pathname + u.search,
      method: 'GET',
      headers: { 'User-Agent': 'BDSUpdater/1.0' },
    }, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => resolve(data));
    });
    req.setTimeout(timeout, () => { req.destroy(new Error('Request timeout')); });
    req.on('error', reject);
    req.end();
  });
}

function httpDownload(url, destPath, onProgress, timeout = DOWNLOAD_TIMEOUT) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const u = new URL(url);
    const req = mod.request({
      hostname: u.hostname,
      port: u.port || 443,
      path: u.pathname + u.search,
      method: 'GET',
      headers: { 'User-Agent': 'BDSUpdater/1.0' },
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400) {
        const loc = res.headers.location;
        if (!loc) return reject(new Error(`HTTP ${res.statusCode} 无 Location`));
        const redirectUrl = loc.startsWith('http') ? loc : new URL(loc, url).href;
        return resolve(httpDownload(redirectUrl, destPath, onProgress, timeout));
      }
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }
      const total = parseInt(res.headers['content-length'] || '0', 10);
      let downloaded = 0;
      const file = fs.createWriteStream(destPath);
      res.on('data', (chunk) => {
        downloaded += chunk.length;
        const canContinue = file.write(chunk);
        if (!canContinue) {
          res.pause();
          file.once('drain', () => res.resume());
        }
        if (onProgress && total) onProgress(downloaded, total);
      });
      res.on('end', () => { file.end(); resolve(); });
      res.on('error', (err) => { file.close(); reject(err); });
    });
    req.setTimeout(timeout, () => { req.destroy(new Error('Download timeout')); });
    req.on('error', reject);
    req.end();
  });
}

/** 尝试多个源获取 JSON，谁先成功用谁 */
async function fetchJsonWithFallback(sources, timeout = FETCH_TIMEOUT) {
  const results = await Promise.allSettled(
    sources.map((url) => httpGet(url, timeout))
  );
  for (const r of results) {
    if (r.status === 'fulfilled') {
      try { return JSON.parse(r.value); } catch {}
    }
  }
  const errors = results
    .filter((r) => r.status === 'rejected')
    .map((r) => r.reason.message).join('; ');
  throw new Error(`所有源均不可用: ${errors}`);
}

// ────────── QQ 通知 ──────────

async function qqSend(text) {
  try {
    const sender = require(QQ_SENDER);
    await sender.sendText(text);
  } catch (e) {
    log(`[QQ] 发送失败: ${e.message}`);
  }
}

async function qqSendMixed(segments) {
  try {
    const sender = require(QQ_SENDER);
    await sender.sendMixed(segments);
  } catch (e) {
    log(`[QQ] 发送失败: ${e.message}`);
  }
}

async function qqSendImage(text, base64Img) {
  try {
    const sender = require(QQ_SENDER);
    await sender.sendWithImage(text, base64Img);
  } catch (e) {
    log(`[QQ] 发送失败: ${e.message}`);
  }
}

// ────────── 版本获取 ──────────

const CACHE_PATH = path.join(SCRIPT_DIR, '.version_cache.json');

function readCache() {
  try { return JSON.parse(fs.readFileSync(CACHE_PATH, 'utf-8')); } catch { return {}; }
}

function saveCache(ver, sha256) {
  const cache = readCache();
  cache[ver] = { sha256, verified_at: Date.now() };
  // 只保留最近 3 条
  const keys = Object.keys(cache).sort(compareVersions).slice(-3);
  const trimmed = {};
  for (const k of keys) trimmed[k] = cache[k];
  try { fs.writeFileSync(CACHE_PATH, JSON.stringify(trimmed, null, 2)); } catch {}
}

function hashFile(filePath, algo = 'sha256') {
  try {
    const h = crypto.createHash(algo);
    h.update(fs.readFileSync(filePath));
    return h.digest('hex').toLowerCase();
  } catch { return ''; }
}

function getCurrentVersion() {
  const exePath = path.join(BDS_PATH, 'bedrock_server.exe');
  if (!fs.existsSync(exePath)) return '0.0.0.0';

  const actual = hashFile(exePath);
  if (!actual) return '0.0.0.0';

  const cache = readCache();
  for (const [ver, entry] of Object.entries(cache)) {
    if (entry.sha256 === actual) return ver;
  }

  log('[BDSUpdater] 警告: bedrock_server.exe 哈希与缓存记录不匹配，可能已被修改');
  return '0.0.0.0';
}

async function getVersionInfo() {
  log(`[BDSUpdater] 检查最新版本 (${CHANNEL})...`);
  for (let i = 0; i < 3; i++) {
    try {
      const json = await fetchJsonWithFallback([VERSIONS_API, VERSIONS_MIRROR]);
      let ver;
      if (VERSION_MODE === 'endstone') {
        const entry = CHANNEL === 'preview' ? json.preview : json.release;
        if (!entry || !entry.latest) throw new Error('未找到最新版本号');
        ver = entry.latest;
      } else {
        const platform = json.windows || json.linux;
        if (!platform) throw new Error('未找到平台版本信息');
        ver = CHANNEL === 'preview' ? platform.preview : platform.stable;
        if (!ver) throw new Error('未找到最新版本号');
      }
      return { version: ver, cdnRoot: json.cdn_root };
    } catch (e) {
      if (i < 2) {
        const wait = (i + 1) * 3000;
        log(`[BDSUpdater] 获取失败 (${i + 1}/3): ${e.message}，${wait / 1000}s 后重试...`);
        await new Promise((r) => setTimeout(r, wait));
      } else {
        throw e;
      }
    }
  }
}

/** 从 per-version JSON 获取下载链接和哈希 */
async function fetchVersionDetails(version) {
  const platform = CHANNEL === 'preview' ? 'windows_preview' : 'windows';
  const channel = CHANNEL === 'preview' ? 'preview' : 'release';
  const vars = { version, ver3: toVer3(version), platform, channel };
  const sources = [
    resolveTemplate(DETAILS_API, vars),
    DETAILS_MIRROR ? resolveTemplate(DETAILS_MIRROR, vars) : '',
  ].filter(Boolean);

  const json = await fetchJsonWithFallback(sources);
  if (VERSION_MODE === 'endstone') {
    const bw = json.binary?.windows;
    return {
      downloadUrl: bw?.url || '',
      sha1: '',        // Endstone 用 SHA256
      sha256: bw?.sha256 || '',
      size: bw?.size_in_bytes || 0,
    };
  }
  return {
    downloadUrl: json.download_url || '',
    sha1: json.sha1 || '',
    sha256: '',
    size: json.size_in_bytes || 0,
  };
}

/** 文件哈希校验（SHA1 或 SHA256） */
function verifyHash(filePath, sha1, sha256) {
  const expected = sha256 || sha1;
  if (!expected) return true;
  const algo = sha256 ? 'sha256' : 'sha1';
  const hash = crypto.createHash(algo);
  const data = fs.readFileSync(filePath);
  hash.update(data);
  const actual = hash.digest('hex').toLowerCase();
  return actual === expected.toLowerCase();
}

function getDownloadUrls(version, details) {
  const urls = [];
  // 1. 镜像（优先）
  if (DOWNLOAD_MIRROR) {
    const mirrorVer = CHANNEL === 'preview' ? `${version}-preview` : version;
    urls.push(resolveTemplate(DOWNLOAD_MIRROR, { version: mirrorVer }));
  }
  // 2. per-version JSON 中的 download_url
  if (details.downloadUrl) urls.push(details.downloadUrl);
  // 3. cdn_root 拼接
  const cdnRoot = cfg.cdn_root || 'https://www.minecraft.net/bedrockdedicatedserver';
  const suffix = CHANNEL === 'preview'
    ? `/bin-win-preview/bedrock-server-${version}-preview.zip`
    : `/bin-win/bedrock-server-${version}.zip`;
  urls.push(cdnRoot + suffix);
  // 4. azureedge fallback
  urls.push(`https://minecraft.azureedge.net${suffix}`);
  return [...new Set(urls)];
}

function compareVersions(a, b) {
  const pa = a.replace('-preview', '').split('.').map(Number);
  const pb = b.replace('-preview', '').split('.').map(Number);
  for (let i = 0; i < 4; i++) {
    if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) - (pb[i] || 0);
  }
  // preview 低于 release
  if (a.includes('-preview') && !b.includes('-preview')) return -1;
  if (!a.includes('-preview') && b.includes('-preview')) return 1;
  return 0;
}

// ────────── 更新日志获取 ──────────

async function fetchChangelog() {
  try {
    const html = await httpGet(`https://www.minecraft.net/en-us/article/${CHANNEL === 'preview' ? 'bedrock-beta' : 'bedrock'}-update`);
    const cheerio = require('cheerio');
    const $ = cheerio.load(html);
    // 尝试提取文章内容
    const article = $('article').first() || $('.article-content').first() || $('[class*="content"]').first();
    if (!article.length) return null;

    // 提取文本
    const paragraphs = [];
    article.find('p, h2, h3, li').each((i, el) => {
      const text = $(el).text().trim();
      if (text) paragraphs.push(text);
    });
    const text = paragraphs.join('\n').slice(0, 2000);

    // 提取第一张图片
    let imageBase64 = null;
    const firstImg = article.find('img').first();
    if (firstImg.length) {
      const imgSrc = firstImg.attr('src') || firstImg.attr('data-src');
      if (imgSrc) {
        try {
          const imgUrl = imgSrc.startsWith('http') ? imgSrc : `https://www.minecraft.net${imgSrc}`;
          const imgData = await httpGet(imgUrl);
          imageBase64 = Buffer.from(imgData, 'binary').toString('base64');
        } catch (e) {
          log(`[BDSUpdater] 获取图片失败: ${e.message}`);
        }
      }
    }

    return { text: text.slice(0, 2000), imageBase64 };
  } catch (e) {
    log(`[BDSUpdater] 获取更新日志失败: ${e.message}`);
    return null;
  }
}

// ────────── 备份 ──────────

function doBackup() {
  const dateStr = new Date().toISOString().slice(0, 10);
  const backupDir = path.join(BACKUP_DIR, dateStr);
  fs.mkdirSync(backupDir, { recursive: true });

  const preserve = cfg.preserve || [];
  let totalSize = 0;

  for (const item of preserve) {
    const src = path.join(BDS_PATH, item);
    const dest = path.join(backupDir, item);
    if (!fs.existsSync(src)) {
      log(`[BDSUpdater] 跳过不存在: ${item}`);
      continue;
    }
    // 确保目标目录存在
    const destDir = path.dirname(dest);
    fs.mkdirSync(destDir, { recursive: true });

    if (fs.statSync(src).isDirectory()) {
      copyDirSync(src, dest);
    } else {
      const stat = fs.statSync(src);
      fs.copyFileSync(src, dest);
      totalSize += stat.size;
    }
    log(`[BDSUpdater] 已备份: ${item}`);
  }

  // 计算总大小
  totalSize = getDirSize(backupDir);
  return { path: backupDir, size: totalSize };
}

function copyDirSync(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src)) {
    const srcPath = path.join(src, entry);
    const destPath = path.join(dest, entry);
    if (fs.statSync(srcPath).isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function getDirSize(dir) {
  let total = 0;
  try {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) total += getDirSize(full);
      else if (entry.isFile()) total += fs.statSync(full).size;
    }
  } catch {}
  return total;
}

// ────────── 更新程序 ──────────

async function main() {
  log(`[BDSUpdater] ===== 开始检查更新 (${CHANNEL}) =====`);

  // 1. 获取版本
  const currentVer = getCurrentVersion();
  log(`[BDSUpdater] 当前版本: ${currentVer}`);

  let latestVer, cdnRoot, downloadUrls;
  try {
    const info = await getVersionInfo();
    latestVer = info.version;
    cdnRoot = info.cdnRoot;
    log(`[BDSUpdater] 最新版本: ${latestVer}`);

    // 检查是否需要更新
    const cmp = compareVersions(latestVer, currentVer);
    if (cmp <= 0 && !FORCE) {
      log(`[BDSUpdater] 已是最新版本，无需更新`);
      return;
    }
    log(`[BDSUpdater] 发现新版本: ${currentVer} → ${latestVer}`);

    const details = await fetchVersionDetails(latestVer);
    downloadUrls = getDownloadUrls(latestVer, details);
    cfg._hash = { sha1: details.sha1, sha256: details.sha256 };
  } catch (e) {
    logError(`[BDSUpdater] 获取版本信息失败: ${e.message}`);
    await qqSend(`❌ BDS 更新失败\n\n无法获取版本信息: ${e.message}`);
    process.exit(1);
  }

  if (CHECK_ONLY) {
    log(`[BDSUpdater] 仅检查模式，退出`);
    console.log(`CURRENT=${currentVer}`);
    console.log(`LATEST=${latestVer}`);
    return;
  }

  // 2. QQ 通知 — 更新预告
  if (cfg.qq_notify) {
    await qqSend(
      `𝐌𝐢𝐧𝐞𝐜𝐫𝐚𝐟𝐭 𝐁𝐃𝐒 更新通知\n\n` +
      `检测到新版本！\n\n` +
      `当前版本: ${currentVer}\n` +
      `最新版本: ${latestVer}\n` +
      `频道: ${CHANNEL === 'preview' ? '预览版' : '正式版'}\n\n` +
      `服务器即将开始更新~ 请耐心等待^(*￣(oo)￣)^`
    );

    // 更新日志
    const changelog = await fetchChangelog();
    if (changelog) {
      const textParts = [
        `📋 更新内容概要\n\n`,
        changelog.text.slice(0, 1500),
        `\n\n完整日志: ${CHANGELOG_BASE}`,
      ];
      if (changelog.imageBase64) {
        await qqSendImage(textParts.join(''), changelog.imageBase64);
      } else {
        await qqSend(textParts.join(''));
      }
    } else {
      await qqSend(`📋 更新日志: ${CHANGELOG_BASE}`);
    }

    // 备份预告
    await qqSend(`正在备份服务器文件...\n\n` +
      (cfg.preserve || []).map((i) => `• ${i}`).join('\n'));
  }

  // 3. 备份
  let backupResult;
  try {
    backupResult = doBackup();
    const sizeMB = (backupResult.size / 1024 / 1024).toFixed(1);
    log(`[BDSUpdater] 备份完成: ${backupResult.path} (${sizeMB} MB)`);

    if (cfg.qq_notify) {
      await qqSend(
        `✅ 备份完成\n\n` +
        `备份大小: ${sizeMB} MB\n` +
        `备份位置: ${backupResult.path}`
      );
    }
  } catch (e) {
    logError(`[BDSUpdater] 备份失败: ${e.message}`);
    await qqSend(`❌ BDS 更新失败\n\n备份失败: ${e.message}\n操作已中止`);
    process.exit(1);
  }

  // 4. 停止 BDS（优雅关闭）
  log(`[BDSUpdater] 停止 BDS 服务...`);
  try {
    await bds.stop();
    log(`[BDSUpdater] BDS 已停止`);
  } catch (e) {
    log(`[BDSUpdater] BDS 停止异常: ${e.message}`);
  }

  // 5. 下载（多域名 fallback）
  const zipPath = path.join(SCRIPT_DIR, `bedrock-server-${latestVer}.zip`);
  try {
    log(`[BDSUpdater] 开始下载 ${latestVer}...`);
    await qqSend(`📥 正在下载 BDS ${latestVer}...`);

    let lastProgress = 0;
    let lastErr;
    for (const url of downloadUrls) {
      try {
        await httpDownload(url, zipPath, (downloaded, total) => {
          const pct = Math.floor((downloaded / total) * 100);
          if (pct - lastProgress >= 25 || pct === 100) {
            lastProgress = pct;
            log(`[BDSUpdater] 下载进度: ${pct}% (${(downloaded / 1024 / 1024).toFixed(1)}MB / ${(total / 1024 / 1024).toFixed(1)}MB)`);
          }
        });
        lastErr = null;
        break;
      } catch (e) {
        lastErr = e;
        log(`[BDSUpdater] ${url} 不可用: ${e.message}，尝试备用地址...`);
      }
    }
    if (lastErr) throw lastErr;

    const zipSizeMB = (fs.statSync(zipPath).size / 1024 / 1024).toFixed(1);
    log(`[BDSUpdater] 下载完成 (${zipSizeMB} MB)`);

    // 哈希校验
    const h = cfg._hash;
    if (h && (h.sha1 || h.sha256)) {
      const algo = h.sha256 ? 'SHA256' : 'SHA1';
      log(`[BDSUpdater] 校验文件完整性 (${algo})...`);
      if (!verifyHash(zipPath, h.sha1, h.sha256)) {
        throw new Error(`${algo} 校验不通过，文件可能损坏`);
      }
      log(`[BDSUpdater] ${algo} 校验通过`);
    }
  } catch (e) {
    logError(`[BDSUpdater] 下载失败: ${e.message}`);
    await qqSend(`❌ BDS 更新失败\n\n下载失败: ${e.message}\nBDS 已停止，请手动处理`);
    process.exit(1);
  }

  // 6. 清空 BDS 目录 → 解压 → 删除 preserves → 恢复备份
  log(`[BDSUpdater] 清空 BDS 目录...`);
  for (const entry of fs.readdirSync(BDS_PATH)) {
    const full = path.join(BDS_PATH, entry);
    try {
      if (fs.statSync(full).isDirectory()) fs.rmSync(full, { recursive: true });
      else fs.unlinkSync(full);
    } catch (e) {
      log(`[BDSUpdater] 无法删除 ${entry}: ${e.message}`);
    }
  }

  const tempDir = path.join(SCRIPT_DIR, `_extract_${Date.now()}`);
  try {
    log(`[BDSUpdater] 解压中...`);
    const zip = new AdmZip(zipPath);
    zip.extractAllTo(tempDir, true);
    copyDirSync(tempDir, BDS_PATH);
    log(`[BDSUpdater] 解压完成`);
    fs.unlinkSync(zipPath);
  } catch (e) {
    logError(`[BDSUpdater] 解压失败: ${e.message}`);
    await qqSend(`❌ BDS 更新失败\n\n解压失败: ${e.message}\nBDS 已停止，请手动恢复备份`);
    process.exit(1);
  } finally {
    try { fs.rmSync(tempDir, { recursive: true }); } catch {}
  }

  // 删除 preserves 列表中的内容，准备恢复旧备份
  for (const item of cfg.preserve || []) {
    const dest = path.join(BDS_PATH, item);
    if (fs.existsSync(dest)) {
      if (fs.statSync(dest).isDirectory()) fs.rmSync(dest, { recursive: true });
      else fs.unlinkSync(dest);
    }
  }

  // 从备份恢复 preserves
  log(`[BDSUpdater] 恢复备份配置...`);
  const dateStr = new Date().toISOString().slice(0, 10);
  const backupDir = path.join(BACKUP_DIR, dateStr);
  for (const item of cfg.preserve || []) {
    const src = path.join(backupDir, item);
    const dest = path.join(BDS_PATH, item);
    if (!fs.existsSync(src)) continue;
    if (fs.statSync(src).isDirectory()) {
      copyDirSync(src, dest);
    } else {
      const destDir = path.dirname(dest);
      fs.mkdirSync(destDir, { recursive: true });
      fs.copyFileSync(src, dest);
    }
    log(`[BDSUpdater] 已恢复: ${item}`);
  }

  // 写入版本缓存（hash bedrock_server.exe 用于后续比对）
  const exePath = path.join(BDS_PATH, 'bedrock_server.exe');
  const exeHash = hashFile(exePath);
  if (exeHash) {
    saveCache(latestVer, exeHash);
    log(`[BDSUpdater] 已记录版本 ${latestVer} 的 SHA256`);
  }

  // 8. 启动 BDS
  if (AUTO_RESTART) {
    try {
      log(`[BDSUpdater] 启动 BDS...`);
      await bds.start();
    } catch (e) {
      logError(`[BDSUpdater] 启动失败: ${e.message}`);
      await qqSend(`❌ BDS 更新失败\n\n启动失败: ${e.message}\n请手动启动 BDS`);
      process.exit(1);
    }
  }

  // 9. QQ 通知结果
  if (cfg.qq_notify) {
    const totalTime = 'N/A'; // we don't track start time, could add later
    await qqSend(
      `✅ BDS 更新完成\n\n` +
      `从 ${currentVer} → ${latestVer}\n` +
      `${AUTO_RESTART ? '服务器已重新启动' : '请手动重启服务器'}`
    );
  }

  log(`[BDSUpdater] ===== 更新完成 =====`);
}

main().catch((e) => {
  logError(`[BDSUpdater] 未捕获错误: ${e.message}`);
  process.exit(1);
});
