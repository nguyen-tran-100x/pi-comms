import { execFileSync } from 'node:child_process';
import { mkdirSync, existsSync, symlinkSync } from 'node:fs';
import { resolve } from 'node:path';

const revision = '02913edcd7b1bdb21b480852ff82f674d309c651';
const destination = resolve('.scratch/upstream');
mkdirSync('.scratch', { recursive: true });
if (!existsSync(destination)) {
  execFileSync('git', ['clone', 'https://github.com/nicobailon/pi-intercom.git', destination], { stdio: 'inherit' });
  execFileSync('git', ['-C', destination, 'checkout', '--detach', revision], { stdio: 'inherit' });
}
const actual = execFileSync('git', ['-C', destination, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
if (actual !== revision) throw new Error(`Wrong fixture revision: ${actual}`);
if (execFileSync('git', ['-C', destination, 'status', '--porcelain', '--', '.', ':!node_modules'], { encoding: 'utf8' }).trim()) {
  throw new Error('Upstream fixture has edits; use a clean clone.');
}
if (!existsSync(resolve(destination, 'node_modules'))) {
  symlinkSync(resolve('node_modules'), resolve(destination, 'node_modules'), 'dir');
}
console.log(`Prepared original intercom ${revision}; no installed package changed.`);
