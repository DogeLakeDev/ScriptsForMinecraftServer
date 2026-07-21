#!/usr/bin/env node
/**
 * tools/fetch-module.mjs — populate ./modules/packages/<id>/ from a source.
 *
 * Sources:
 *   local:<zip-path>      extract a local zip into modules/packages/<id>/
 *   dir:<dir-path>        copy a directory into modules/packages/<id>/
 *   github:<owner>/<repo>[@<tag>]   fetch sfmc-module-<id>-<version>.zip
 *                                   from GitHub Releases (optionally verify
 *                                   against the .sha256 sidecar)
 *
 * Usage:
 *   node tools/fetch-module.mjs list                                    # list available modules in the GitHub release
 *   node tools/fetch-module.mjs install <id> --from github:owner/repo[@tag]
 *   node tools/fetch-module.mjs install <id> --from local:/abs/path/to/foo.zip
 *   node tools/fetch-module.mjs install <id> --from dir:/abs/path/to/foo/
 *
 * Install target:
 *   modules/packages/<id>/
 *
 * SHA-256 verification:
 *   For github: source, the .sha256 sidecar is fetched and verified if present.
 *   For local: source, --sha256 <hex> may be passed.
 *
 * Note: This is a build-time / one-shot tool. The SEA itself never calls this;
 * it only reads from the resulting `modules/packages/<id>/` directories.
 */

import fs from "node:fs";
import fsp from "node:fs/promises";
import { createHash } from "node:crypto";
import { createReadStream, Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const TARGET = path.join(ROOT, "modules", "packages");

const [, , verb, ...rest] = process.argv;

function die(msg, code = 1) {
  console.error(`[fetch-module] ${msg}`);
  process.exit(code);
}

function parseFlags(args) {
  const flags = { from: null, sha256: null };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--from") flags.from = args[++i];
    else if (a === "--sha256") flags.sha256 = args[++i];
  }
  return flags;
}

async function ensureTarget(id) {
  const dir = path.join(TARGET, id);
  await fsp.rm(dir, { recursive: true, force: true });
  await fsp.mkdir(dir, { recursive: true });
  return dir;
}

async function sha256OfStream(stream) {
  const hash = createHash("sha256");
  await pipeline(stream, async function* (src) {
    for await (const chunk of src) {
      hash.update(chunk);
      yield chunk;
    }
  });
  return hash.digest("hex");
}

async function sha256OfFile(file) {
  const hash = createHash("sha256");
  await pipeline(createReadStream(file), async function* (src) {
    for await (const chunk of src) {
      hash.update(chunk);
      yield chunk;
    }
  });
  return hash.digest("hex");
}

async function fetchToBuffer(url) {
  const res = await fetch(url, { headers: { "User-Agent": "sfmc-fetch-module" } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

/* ── source: local:<zip-path> ─────────────────────────────── */
async function fromLocal(id, source, flags) {
  const zipPath = source.slice("local:".length);
  if (!fs.existsSync(zipPath)) die(`local zip not found: ${zipPath}`);
  const actual = await sha256OfFile(zipPath);
  if (flags.sha256 && flags.sha256.toLowerCase() !== actual) {
    die(`SHA-256 mismatch (local): expected ${flags.sha256}, got ${actual}`);
  }
  const dir = await ensureTarget(id);
  await unzip(zipPath, dir);
  console.log(`[fetch-module] installed ${id} from ${zipPath}`);
  console.log(`[fetch-module]   sha256: ${actual}`);
  console.log(`[fetch-module]   target: ${dir}`);
}

/* ── source: dir:<dir-path> ───────────────────────────────── */
async function fromDir(id, source) {
  const srcDir = source.slice("dir:".length);
  if (!fs.existsSync(srcDir)) die(`local dir not found: ${srcDir}`);
  const dir = await ensureTarget(id);
  await copyDir(srcDir, dir);
  console.log(`[fetch-module] installed ${id} from dir ${srcDir}`);
  console.log(`[fetch-module]   target: ${dir}`);
}

/* ── source: github:<owner>/<repo>[@<tag>] ────────────────── */
async function fromGithub(id, source, flags) {
  let owner, repo, tag = "latest";
  const body = source.slice("github:".length);
  const tagIdx = body.lastIndexOf("@");
  if (tagIdx > 0) {
    tag = body.slice(tagIdx + 1);
    [owner, repo] = body.slice(0, tagIdx).split("/");
  } else {
    [owner, repo] = body.split("/");
  }
  if (!owner || !repo) die(`invalid github source: ${source}`);

  const releasePath = tag === "latest" ? "latest" : `tags/${encodeURIComponent(tag)}`;
  const releaseUrl = `https://api.github.com/repos/${owner}/${repo}/releases/${releasePath}`;
  const relRes = await fetch(releaseUrl, { headers: { Accept: "application/vnd.github+json", "User-Agent": "sfmc-fetch-module" } });
  if (!relRes.ok) die(`github release ${releaseUrl} → HTTP ${relRes.status}`);
  const rel = await relRes.json();

  const assetRe = /^sfmc-module-([a-z0-9-]+)-(\d+\.\d+\.\d+)\.zip$/;
  let asset = null;
  for (const a of rel.assets ?? []) {
    const m = assetRe.exec(a.name);
    if (m && m[1] === id) {
      asset = a;
      break;
    }
  }
  if (!asset) die(`module ${id} not found in release ${rel.tag_name ?? tag}`);

  const versionMatch = assetRe.exec(asset.name);
  const version = versionMatch[2];
  console.log(`[fetch-module] fetching ${asset.name} (${(asset.size / 1024).toFixed(1)} KB)`);

  const zipBuf = await fetchToBuffer(asset.browser_download_url);
  const actual = createHash("sha256").update(zipBuf).digest("hex");

  /* Try sidecar .sha256 file */
  if (!flags.sha256) {
    const shaUrl = asset.browser_download_url.replace(/\.zip$/, ".sha256");
    try {
      const shaBuf = await fetchToBuffer(shaUrl);
      const text = shaBuf.toString("utf8").trim().split(/\s+/)[0];
      if (/^[a-f0-9]{64}$/.test(text)) flags.sha256 = text;
    } catch {
      /* sidecar optional */
    }
  }

  if (flags.sha256 && flags.sha256.toLowerCase() !== actual) {
    die(`SHA-256 mismatch (github): expected ${flags.sha256}, got ${actual}`);
  }

  const dir = await ensureTarget(id);
  const stagedZip = path.join(dir, "_staged.zip");
  await fsp.writeFile(stagedZip, zipBuf);
  await unzip(stagedZip, dir);
  await fsp.rm(stagedZip, { force: true });
  console.log(`[fetch-module] installed ${id} v${version} from ${owner}/${repo}@${rel.tag_name ?? tag}`);
  console.log(`[fetch-module]   sha256: ${actual}`);
  console.log(`[fetch-module]   target: ${dir}`);
}

async function listGithub(source) {
  let owner, repo, tag = "latest";
  const body = source.slice("github:".length);
  const tagIdx = body.lastIndexOf("@");
  if (tagIdx > 0) {
    tag = body.slice(tagIdx + 1);
    [owner, repo] = body.slice(0, tagIdx).split("/");
  } else {
    [owner, repo] = body.split("/");
  }
  if (!owner || !repo) die(`invalid github source: ${source}`);
  const releasePath = tag === "latest" ? "latest" : `tags/${encodeURIComponent(tag)}`;
  const releaseUrl = `https://api.github.com/repos/${owner}/${repo}/releases/${releasePath}`;
  const relRes = await fetch(releaseUrl, { headers: { Accept: "application/vnd.github+json", "User-Agent": "sfmc-fetch-module" } });
  if (!relRes.ok) die(`github release ${releaseUrl} → HTTP ${relRes.status}`);
  const rel = await relRes.json();
  console.log(`Release: ${rel.tag_name ?? tag} (${rel.name ?? ""})`);
  const assetRe = /^sfmc-module-([a-z0-9-]+)-(\d+\.\d+\.\d+)\.zip$/;
  for (const a of rel.assets ?? []) {
    const m = assetRe.exec(a.name);
    if (m) console.log(`  ${m[1].padEnd(28)} v${m[2].padEnd(8)} ${(a.size / 1024).toFixed(1)} KB`);
  }
}

/* ── unzip via Node built-in (Node 22+ has node:zlib; here we use JSZip) ── */
async function unzip(zipPath, dstDir) {
  const JSZip = (await import("jszip")).default;
  const data = await fsp.readFile(zipPath);
  const zip = await JSZip.loadAsync(data);
  const entries = Object.values(zip.files);
  for (const e of entries) {
    const out = path.join(dstDir, e.name);
    if (e.dir) {
      await fsp.mkdir(out, { recursive: true });
      continue;
    }
    await fsp.mkdir(path.dirname(out), { recursive: true });
    const buf = await e.async("nodebuffer");
    await fsp.writeFile(out, buf);
  }
}

async function copyDir(src, dst) {
  await fsp.mkdir(dst, { recursive: true });
  for (const e of await fsp.readdir(src, { withFileTypes: true })) {
    const sp = path.join(src, e.name);
    const dp = path.join(dst, e.name);
    if (e.isDirectory()) await copyDir(sp, dp);
    else if (e.isFile()) await fsp.copyFile(sp, dp);
  }
}

/* ── entry ──────────────────────────────────────────────── */
async function main() {
  if (!verb) {
    console.log(`tools/fetch-module.mjs — populate ./modules/packages/<id>/

Commands:
  install <id> --from <source>     fetch and install
  list          --from github:o/r[@tag]    list available modules in a release

Sources:
  local:/abs/path/to/foo.zip
  dir:/abs/path/to/foo/
  github:owner/repo[@tag]
`);
    return;
  }
  if (verb === "list") {
    const flags = parseFlags(rest);
    if (!flags.from || !flags.from.startsWith("github:")) die("--from github:owner/repo required");
    await listGithub(flags.from);
    return;
  }
  if (verb !== "install") die(`unknown verb: ${verb}`);
  const id = rest[0];
  if (!id) die("usage: install <id> --from <source>");
  const flags = parseFlags(rest.slice(1));
  if (!flags.from) die("--from <source> required");

  if (flags.from.startsWith("local:")) return fromLocal(id, flags.from, flags);
  if (flags.from.startsWith("dir:")) return fromDir(id, flags.from);
  if (flags.from.startsWith("github:")) return fromGithub(id, flags.from, flags);
  die(`unknown source: ${flags.from}`);
}

main().catch((e) => die(e?.message ?? String(e)));