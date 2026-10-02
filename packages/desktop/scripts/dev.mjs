import { spawn } from 'node:child_process';
import { createServer } from 'vite';
import { build } from 'esbuild';
import electron from 'electron';
await build({ entryPoints: ['src/main/main.ts', 'src/main/preload.ts'], outdir: 'dist', outbase: 'src/main', bundle: true, platform: 'node', format: 'cjs', outExtension: { '.js': '.cjs' }, external: ['electron', 'ssh2', 'electron-updater'] });
const server = await createServer({ server: { host: '127.0.0.1', port: 5173, strictPort: true } });
await server.listen();
const child = spawn(electron, ['.'], { env: { ...process.env, SFMC_DESKTOP_DEV_URL: 'http://127.0.0.1:5173', SFMC_DESKTOP_DEV_NODE: process.execPath }, stdio: 'inherit', windowsHide: true });
child.on('exit', async code => { await server.close(); process.exitCode = code ?? 0; });
