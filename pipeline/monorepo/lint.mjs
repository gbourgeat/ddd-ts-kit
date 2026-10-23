#!/usr/bin/env node
// ESLint with its cache. The content strategy keys the cache by the content of each linted file
// and by the config, not by the code of the rules; the rules of the kit live in this repository
// and change often, so the cache is dropped when their build, the ESLint config or the lockfile
// changed since it was written: a rule made stricter is then run on every file again.
//
//   node pipeline/monorepo/lint.mjs [arguments of eslint, `.` by default]
//
// The cache lives in .eslintcache/ (ignored by git), next to the key it was written for.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const CACHE = '.eslintcache';
const KEY = path.join(CACHE, 'key');
/** What the rules and their setting are built from: the plugin as built, the config, the versions installed. */
const INPUTS = ['packages/eslint-plugin/dist', 'eslint.config.mjs', 'package-lock.json'];

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exit(main(process.argv.slice(2)));
}

function main(args) {
  keepOrDropCache(ROOT);

  const eslint = path.join(ROOT, 'node_modules/.bin/eslint');
  const options = [
    '--config',
    'eslint.config.mjs',
    '--cache',
    '--cache-location',
    `${CACHE}/`,
    '--cache-strategy',
    'content',
  ];
  const run = spawnSync(eslint, [...options, ...(args.length === 0 ? ['.'] : args)], { cwd: ROOT, stdio: 'inherit' });

  return run.status ?? 1;
}

/** The cache stays when it was written for the inputs of today; otherwise it goes, and the key of today is written. */
function keepOrDropCache(root) {
  const key = cacheKey(root);
  const written = fs.existsSync(path.join(root, KEY)) ? fs.readFileSync(path.join(root, KEY), 'utf8') : '';

  if (written !== key) {
    fs.rmSync(path.join(root, CACHE), { recursive: true, force: true });
    fs.mkdirSync(path.join(root, CACHE), { recursive: true });
    fs.writeFileSync(path.join(root, KEY), key);
  }
}

/** One hash of every input, each by its path and its content, so that a rule rebuilt or a config edited changes it. */
export function cacheKey(root) {
  return hashOf(
    INPUTS.flatMap((input) => filesUnder(root, input)).map((file) => [file, fs.readFileSync(path.join(root, file))]),
  );
}

export function hashOf(entries) {
  const hash = createHash('sha256');

  for (const [name, content] of entries) {
    hash.update(name).update('\0').update(content).update('\0');
  }

  return hash.digest('hex').slice(0, 16);
}

/** The files under a path, relative to the root and sorted; nothing when the path does not exist (the plugin not built yet). */
function filesUnder(root, input) {
  const absolute = path.join(root, input);

  if (!fs.existsSync(absolute)) {
    return [];
  }

  if (fs.statSync(absolute).isFile()) {
    return [input];
  }

  return fs
    .readdirSync(absolute, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => path.relative(root, path.join(entry.parentPath, entry.name)))
    .sort();
}
