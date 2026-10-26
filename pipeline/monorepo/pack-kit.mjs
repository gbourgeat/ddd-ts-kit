#!/usr/bin/env node
// Packs every package of `packages/` as `npm pack` makes it, which is what a registry would serve, and answers the
// file that names them: `{ "<package name>": "file:<path of its tarball>" }`. The end-to-end specs that install a
// generated project for real take the kit from there (`packages/cli/test/e2e/packed-kit.ts`).
//
//   node pipeline/monorepo/pack-kit.mjs <destination>
//
// The tarballs and `kit.json` are written in <destination>; the path of `kit.json` is printed. The managers job runs it once,
// before its spec files, and hands the path over as DDD_TS_KIT_PACKED_KIT: without that, each spec file packs the kit
// itself (twelve seconds on a workstation, more on a runner, once per file).
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

if (process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [destination] = process.argv.slice(2);

  if (destination === undefined) {
    console.error('usage: node pipeline/monorepo/pack-kit.mjs <destination>');
    process.exit(2);
  }

  console.log(packKit(path.join(ROOT, 'packages'), path.resolve(destination)));
}

/** Packs each package of `packages` into `destination`, writes `kit.json` there and answers its path. */
export function packKit(packages, destination) {
  fs.mkdirSync(destination, { recursive: true });

  const kit = Object.fromEntries(
    fs.readdirSync(packages).map((directory) => {
      const source = path.join(packages, directory);
      const { name } = JSON.parse(fs.readFileSync(path.join(source, 'package.json'), 'utf8'));

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

  const file = path.join(destination, 'kit.json');

  fs.writeFileSync(file, `${JSON.stringify(kit, null, 2)}\n`);

  return file;
}
