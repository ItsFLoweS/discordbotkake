import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
function walk(dir) { for (const f of readdirSync(dir, { withFileTypes: true })) { if (f.name === 'node_modules') continue; const path = join(dir, f.name); if (f.isDirectory()) walk(path); else if (/\.[cm]?js$/.test(path)) { const r = spawnSync(process.execPath, ['--check', path], { stdio: 'inherit' }); if (r.status) process.exit(r.status); } } }
walk('runtime'); walk('scripts');
