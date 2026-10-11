import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { REPO_ROOT, tempDir } from '../helpers.js';

let packed: Readonly<Record<string, string>> | undefined;

/**
 * Every package of the kit as `npm pack` makes it, which is what a registry would serve: the
 * name of each package and the `file:` specifier of its tarball. Packed once per run, from the
 * built workspace (`npm run build` at the root first).
 */
export function packedKit(): Readonly<Record<string, string>> {
  packed ??= pack();

  return packed;
}

function pack(): Record<string, string> {
  const destination = tempDir('packed');
  const packages = path.join(REPO_ROOT, 'packages');

  return Object.fromEntries(
    fs.readdirSync(packages).map((directory) => {
      const source = path.join(packages, directory);
      const { name } = JSON.parse(fs.readFileSync(path.join(source, 'package.json'), 'utf8')) as { name: string };

      const [tarball = ''] = execFileSync('npm', ['pack', '--silent', '--pack-destination', destination], {
        cwd: source,
        encoding: 'utf8',
      })
        .trim()
        .split('\n')
        .slice(-1);

      return [name, `file:${path.join(destination, tarball)}`];
    }),
  );
}
