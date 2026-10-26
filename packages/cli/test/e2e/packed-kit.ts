import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { REPO_ROOT, tempDir } from '../helpers';

let packed: Readonly<Record<string, string>> | undefined;

/**
 * Every package of the kit as `npm pack` makes it, which is what a registry would serve: the
 * name of each package and the `file:` specifier of its tarball. Read from the file the pipeline
 * wrote once for the whole job (`DDD_TS_KIT_PACKED_KIT`, `pipeline/monorepo/pack-kit.mjs`), else packed
 * once per run, from the built workspace (`npm run build` at the root first).
 */
export function packedKit(): Readonly<Record<string, string>> {
  packed ??= JSON.parse(fs.readFileSync(process.env['DDD_TS_KIT_PACKED_KIT'] ?? pack(), 'utf8')) as Record<
    string,
    string
  >;

  return packed;
}

function pack(): string {
  const script = path.join(REPO_ROOT, 'pipeline/monorepo/pack-kit.mjs');

  return execFileSync(process.execPath, [script, tempDir('packed')], { encoding: 'utf8' }).trim();
}
