// Runs the native TypeScript compiler wherever the package manager installed it. The generated
// scripts name `node_modules/@typescript/native/bin/tsc`, which is true in a project of its own
// and false in a workspace, where the package is hoisted to the root.
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import process from 'node:process';

// The package exports no path to its executable: it is found from its manifest.
const manifest = createRequire(import.meta.url).resolve('@typescript/native/package.json');
const compiler = path.join(path.dirname(manifest), 'bin/tsc');
const run = spawnSync(process.execPath, [compiler, ...process.argv.slice(2)], { stdio: 'inherit' });

process.exit(run.status ?? 1);
