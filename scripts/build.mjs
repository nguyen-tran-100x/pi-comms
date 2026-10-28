import { build } from 'esbuild';
import { mkdir, writeFile } from 'node:fs/promises';
await mkdir('dist', { recursive: true });
await build({ entryPoints: ['src/extension.ts', 'src/transport/broker/broker.ts'], outdir: 'dist', outbase: 'src', bundle: true, platform: 'node', format: 'esm', target: 'node22', packages: 'external', sourcemap: true, banner: { js: '// Includes MIT-adapted pi-intercom code. See THIRD-PARTY-NOTICES.md.' } });
await writeFile('dist/VERSION', JSON.parse(await (await import('node:fs/promises')).readFile('package.json', 'utf8')).version + '\n');
