#!/usr/bin/env node
/**
 * Publishes every package of `packages/` at the given version. A package the registry already
 * holds at that version is skipped, so a release that stopped half-way is finished by running
 * it again. A version with a pre-release part goes under the `next` tag, never under `latest`.
 * `--dry-run` packs and reports without publishing. `--registry <url>` publishes to another
 * registry than the one npm is configured for (GitHub Packages, which keeps no provenance).
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '../..');
const [version, ...flags] = process.argv.slice(2);
const dryRun = flags.includes('--dry-run');
const registry = flags.includes('--registry') ? flags[flags.indexOf('--registry') + 1] : undefined;
const target = registry === undefined ? [] : ['--registry', registry, '--provenance=false'];

process.exit(main());

function main() {
  if (version === undefined || version.startsWith('--')) {
    console.error('Usage: publish-packages.mjs <version> [--dry-run]');

    return 2;
  }

  const failed = packages().filter((entry) => !published(entry));

  if (failed.length > 0) {
    console.error(`\nNot published: ${failed.map((entry) => entry.name).join(', ')}`);
  }

  return failed.length === 0 ? 0 : 1;
}

function packages() {
  return fs
    .readdirSync(path.join(ROOT, 'packages'))
    .map((directory) => ({ directory: path.join(ROOT, 'packages', directory), ...manifestOf(directory) }))
    .filter((entry) => entry.private !== true);
}

function manifestOf(directory) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, 'packages', directory, 'package.json'), 'utf8'));
}

function published(entry) {
  if (entry.version !== version) {
    console.error(`${entry.name} states ${entry.version}, not ${version}.`);

    return false;
  }

  if (onRegistry(entry)) {
    console.log(`${entry.name}@${version} is already on the registry: skipped.`);

    return true;
  }

  const tag = version.includes('-') ? 'next' : 'latest';
  const run = spawnSync('npm', ['publish', '--tag', tag, ...target, ...(dryRun ? ['--dry-run'] : [])], {
    cwd: entry.directory,
    stdio: 'inherit',
  });

  return run.status === 0;
}

function onRegistry(entry) {
  const where = registry === undefined ? [] : ['--registry', registry];
  const view = spawnSync('npm', ['view', `${entry.name}@${version}`, 'version', ...where], { encoding: 'utf8' });

  return view.status === 0 && view.stdout.trim() === version;
}
