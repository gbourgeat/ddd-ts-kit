import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

/** Where ESLint keeps its cache in a project, next to the key it was written for; a directory, ignored by git. */
const LINT_CACHE = '.eslintcache';

/**
 * What the verdict of a file depends on besides its content: the rules as installed (the lockfile
 * of the package manager), the config of the lint, and the config of the project the rules read.
 */
const INPUTS = ['package-lock.json', 'pnpm-lock.yaml', 'yarn.lock', 'eslint.config.mjs', 'ddd-ts-kit.config.json'];

/**
 * The cache of ESLint of a project: kept when it was written for the inputs of today, dropped
 * otherwise, since the cache keys on the content of each linted file and on the config, not on
 * the rules as installed. Answers where ESLint writes it.
 */
export function lintCacheOf(root: string): string {
  const location = path.join(root, LINT_CACHE);
  const keyFile = path.join(location, 'key');
  const key = cacheKey(root);
  const written = fs.existsSync(keyFile) ? fs.readFileSync(keyFile, 'utf8') : '';

  if (written !== key) {
    fs.rmSync(location, { recursive: true, force: true });
    fs.mkdirSync(location, { recursive: true });
    fs.writeFileSync(keyFile, key);
  }

  return `${location}${path.sep}`;
}

function cacheKey(root: string): string {
  const hash = createHash('sha256');

  for (const input of INPUTS) {
    const file = path.join(root, input);

    if (fs.existsSync(file)) {
      hash.update(input).update('\0').update(fs.readFileSync(file)).update('\0');
    }
  }

  return hash.digest('hex').slice(0, 16);
}
