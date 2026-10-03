import { build as esbuild } from 'esbuild';
import { build as vite } from 'vite';
import path from 'node:path';
const base = process.cwd();
await esbuild({ entryPoints: ['src/main/main.ts', 'src/main/preload.ts'], outdir: 'dist', outbase: 'src/main', bundle: true, platform: 'node', format: 'cjs', target: 'node22', sourcemap: true, outExtension: { '.js': '.cjs' }, external: ['electron', 'ssh2', 'electron-updater'] });
await vite({ root: base, base: './', build: { outDir: path.join(base, 'dist/renderer'), emptyOutDir: false, chunkSizeWarningLimit: 2500 }, server: { host: '127.0.0.1' } });
