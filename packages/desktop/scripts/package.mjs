import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { spawn, execFileSync } from 'node:child_process';

const base = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const root = path.resolve(base, '../..');
const manifest = JSON.parse(await fs.readFile(path.join(base, 'runtime-manifest.json'), 'utf8'));
const desktop = JSON.parse(await fs.readFile(path.join(base, 'package.json'), 'utf8'));
const material = path.join(base, 'payload');
const work = path.join(base, '.pack-work');
const staging = path.join(base, 'staging');
const cache = path.join(base, '.pack-cache');
const pnpmEntry = process.env.SFMC_PNPM_ENTRY ?? process.env.npm_execpath;
if (!pnpmEntry || !pnpmEntry.includes('pnpm')) throw new Error('请通过 pnpm desktop:package 执行，或设置 SFMC_PNPM_ENTRY');
const ledger = new Map();

async function command(bin, args, cwd = root) {
  await new Promise((resolve, reject) => {
    const child = spawn(bin, args, { cwd, env: { ...process.env, CI: 'true' }, windowsHide: true, stdio: 'inherit' });
    child.on('error', reject); child.on('close', code => code === 0 ? resolve() : reject(new Error(`${path.basename(bin)} 失败 (${code})`)));
  });
}
// pnpm 自管理可能提供原生可执行文件，不能把 PE 文件作为 Node 脚本加载。
const pnpm = args => /\.exe$/i.test(pnpmEntry)
  ? command(pnpmEntry, args)
  : command(process.execPath, [pnpmEntry, ...args]);
async function reset(directory) {
  if (path.dirname(directory) !== base) throw new Error('构建目录超出桌面包范围');
  await fs.rm(directory, { recursive: true, force: true }); await fs.mkdir(directory, { recursive: true });
}
async function download(url, target, hash) {
  await fs.mkdir(cache, { recursive: true });
  const cached = path.join(cache, createHash('sha256').update(url).digest('hex'));
  try { const existing = await fs.readFile(cached); const actual = createHash('sha256').update(existing).digest('hex'); if (!hash || hash === actual) { await fs.writeFile(target, existing); return actual; } } catch { /* 首次下载 */ }
  const response = await fetch(url, { signal: AbortSignal.timeout(300_000) });
  if (!response.ok) throw new Error(`下载失败: ${url} (${response.status})`);
  const bytes = Buffer.from(await response.arrayBuffer());
  const actual = createHash('sha256').update(bytes).digest('hex');
  if (hash && actual !== hash) throw new Error(`校验失败: ${url}`);
  await fs.writeFile(target, bytes); await fs.writeFile(cached, bytes); return actual;
}
async function resolveDependency(source, name) {
  let cursor = source;
  for (;;) {
    const candidate = path.join(cursor, 'node_modules', name);
    try { await fs.access(path.join(candidate, 'package.json')); return await fs.realpath(candidate); } catch { /* 上一层 */ }
    const parent = path.dirname(cursor); if (parent === cursor) throw new Error(`无法收集生产依赖 ${name}`); cursor = parent;
  }
}
/** 将 pnpm 部署树转换成普通目录；循环依赖由 Node 向祖先目录解析，发行材料中没有开发链接。 */
async function copyPackage(source, target, ancestors = new Map()) {
  source = await fs.realpath(source);
  const pkg = JSON.parse(await fs.readFile(path.join(source, 'package.json'), 'utf8'));
  await fs.mkdir(target, { recursive: true });
  const selected = pkg.files ? new Set(['package.json', 'LICENSE', 'LICENSE.md', 'NOTICE', ...pkg.files.map(name => name.split('/')[0])]) : null;
  for (const name of await fs.readdir(source)) {
    if (['node_modules', '.git', '.pack-work', 'staging', 'payload', 'release'].includes(name)) continue;
    if (selected && !selected.has(name)) continue;
    await fs.cp(path.join(source, name), path.join(target, name), { recursive: true, dereference: true });
  }
  ledger.set(`${pkg.name}@${pkg.version}`, { name: pkg.name, version: pkg.version });
  const chain = new Map(ancestors); chain.set(pkg.name, source);
  for (const [name] of Object.entries({ ...pkg.dependencies, ...pkg.optionalDependencies })) {
    let dependency;
    try { dependency = await resolveDependency(source, name); } catch (error) { if (pkg.optionalDependencies?.[name]) continue; throw error; }
    const childPkg = JSON.parse(await fs.readFile(path.join(dependency, 'package.json'), 'utf8'));
    if (pkg.dependencies?.[name]) pkg.dependencies[name] = childPkg.version;
    if (pkg.optionalDependencies?.[name]) pkg.optionalDependencies[name] = childPkg.version;
    if (childPkg.os && !childPkg.os.includes(process.platform) && !childPkg.os.includes(`!${process.platform}`)) {
      if (pkg.optionalDependencies?.[name]) continue;
    }
    if (chain.get(name) === dependency) continue;
    await copyPackage(dependency, path.join(target, 'node_modules', name), chain);
  }
  await fs.writeFile(path.join(target, 'package.json'), JSON.stringify(pkg, null, 2));
  if (pkg.name === 'esbuild') {
    const linuxTar = path.join(work, `esbuild-linux-${pkg.version}.tgz`);
    const linux = path.join(work, `esbuild-linux-${pkg.version}`);
    const binaryTarget = path.join(target, 'node_modules', '@esbuild', 'linux-x64');
    await fs.mkdir(linux, { recursive: true });
    await download(`https://registry.npmjs.org/@esbuild/linux-x64/-/linux-x64-${pkg.version}.tgz`, linuxTar);
    await command('tar', ['-xf', linuxTar, '-C', linux]);
    const hash = createHash('sha256').update(await fs.readFile(path.join(linux, 'package/bin/esbuild'))).digest('hex');
    if (pkg['esbuild.binaryHashes']?.['@esbuild/linux-x64/bin/esbuild'] && hash !== pkg['esbuild.binaryHashes']['@esbuild/linux-x64/bin/esbuild']) throw new Error('Linux esbuild 原生材料校验失败');
    await fs.cp(path.join(linux, 'package'), binaryTarget, { recursive: true });
    ledger.set(`@esbuild/linux-x64@${pkg.version}`, { name: '@esbuild/linux-x64', version: pkg.version });
  }
}

await reset(work); await reset(staging); await reset(material);
await pnpm(['--filter', '@sfmc-bds/sfmc...', 'build']);
await pnpm(['--filter', '@sfmc-bds/desktop', 'build']);
// 收集当前 pnpm 锁定并安装的生产依赖闭包；不重新解析版本范围、不携带工作区链接。
const platform = path.join(work, 'platform');
await copyPackage(path.join(root, 'packages/meta'), path.join(platform, 'node_modules', '@sfmc-bds', 'sfmc'));
await command('tar', ['-cf', path.join(material, 'platform.tar'), '-C', work, 'platform']);
const platformPackage = JSON.parse(await fs.readFile(path.join(root, 'packages/meta/package.json'), 'utf8'));
await fs.writeFile(path.join(staging, 'runtime-manifest.json'), JSON.stringify({ ...manifest, platformVersion: platformPackage.version }, null, 2));
await fs.cp(path.join(base, 'dist'), path.join(staging, 'dist'), { recursive: true });
const runtimeDeps = { ssh2: desktop.dependencies.ssh2, 'electron-updater': desktop.dependencies['electron-updater'] };
await fs.writeFile(path.join(staging, 'package.json'), JSON.stringify({ name: desktop.name, version: desktop.version, description: desktop.description, author: 'DogeLakeDev', license: desktop.license, main: desktop.main, packageManager: `pnpm@${manifest.pnpm}`, dependencies: runtimeDeps }, null, 2));
for (const name of Object.keys(runtimeDeps)) await copyPackage(await resolveDependency(base, name), path.join(staging, 'node_modules', name));
const pnpmTar = path.join(work, 'pnpm.tgz');
await download(`https://registry.npmjs.org/pnpm/-/pnpm-${manifest.pnpm}.tgz`, pnpmTar);
await command('tar', ['-xf', pnpmTar, '-C', work]);
await fs.cp(path.join(work, 'package'), path.join(material, 'pnpm'), { recursive: true });
await command('tar', ['-cf', path.join(material, 'pnpm.tar'), '-C', material, 'pnpm']);
const archiveName = `node-v${manifest.node}-win-x64.zip`;
const sums = await (await fetch(`https://nodejs.org/dist/v${manifest.node}/SHASUMS256.txt`)).text();
const nodeHash = sums.split('\n').find(line => line.endsWith(`  ${archiveName}`))?.split(/\s+/)[0];
if (!nodeHash) throw new Error('缺少固定 Node 版本的校验值');
const nodeZip = path.join(work, archiveName);
await download(`https://nodejs.org/dist/v${manifest.node}/${archiveName}`, nodeZip, nodeHash);
await command('tar', ['-xf', nodeZip, '-C', work]);
await fs.cp(path.join(work, `node-v${manifest.node}-win-x64`), path.join(material, 'node'), { recursive: true });
const winswHash = await download('https://github.com/winsw/winsw/releases/download/v2.12.0/WinSW-x64.exe', path.join(material, 'WinSW-x64.exe'), '05b82d46ad331cc16bdc00de5c6332c1ef818df8ceefcd49c726553209b3a0da');
const materials = [];
for (const name of ['platform.tar', 'pnpm.tar', 'WinSW-x64.exe']) materials.push({ name, sha256: createHash('sha256').update(await fs.readFile(path.join(material, name))).digest('hex') });
const sourceCommit = process.env.GITHUB_SHA ?? execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8', windowsHide: true }).trim();
await fs.writeFile(path.join(material, 'release-manifest.json'), JSON.stringify({ sourceCommit, desktopVersion: desktop.version, platformVersion: platformPackage.version, node: { version: manifest.node, sha256: nodeHash }, pnpm: manifest.pnpm, winsw: { version: '2.12.0', sha256: winswHash }, protocolVersion: manifest.protocolVersion, packages: [...ledger.values()].sort((a, b) => a.name.localeCompare(b.name)), materials }, null, 2));
await fs.cp(path.join(material, 'release-manifest.json'), path.join(staging, 'release-manifest.json'));
if (!process.argv.includes('--prepare-only')) {
  const signed = process.argv.includes('--signed');
  if (signed && (!process.env.CSC_LINK || !process.env.CSC_KEY_PASSWORD || !process.env.SFMC_SIGNING_PUBLISHER)) throw new Error('签名发行需要 CSC_LINK、CSC_KEY_PASSWORD 和 SFMC_SIGNING_PUBLISHER；不会生成伪签名发行包');
  await command(process.execPath, [path.join(base, 'node_modules/electron-builder/out/cli/cli.js'), '--config', path.join(base, 'electron-builder.yml'), '--win', '--x64', '--publish', 'never', ...(signed ? ['--config.forceCodeSigning=true', `--config.win.publisherName=${process.env.SFMC_SIGNING_PUBLISHER}`] : ['--config.win.signExecutable=false'])], base);
}
