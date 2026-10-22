import fs from 'node:fs';
import path from 'node:path';
import { read, tempDir } from '../helpers';

/** Package managers that stand for npm and pnpm on the PATH of the specs, and what they were asked. */
export interface StubInstallers {
  /** Each call, one line: `<program> <arguments> in <directory>`. */
  calls(): string[];
  /** Makes the next installs fail, printing an error, or pass again. */
  failing(fails: boolean): void;
  /** Puts the PATH back as it was. */
  restore(): void;
}

/**
 * Puts `npm` and `pnpm` stand-ins first on the PATH: each records its call, then creates
 * `node_modules` in its directory, or fails as an install without a lockfile does.
 */
export function stubInstallers(): StubInstallers {
  const bin = tempDir('installers');
  const log = path.join(bin, 'calls.log');
  const flag = path.join(bin, 'fails');
  const previous = process.env['PATH'];

  for (const program of ['npm', 'pnpm']) {
    const script = [
      '#!/bin/sh',
      `echo "${program} $* in $PWD" >> "${log}"`,
      `if [ -f "${flag}" ]; then echo "${program} error The lockfile is missing" >&2; exit 1; fi`,
      'mkdir -p node_modules',
    ];

    fs.writeFileSync(path.join(bin, program), `${script.join('\n')}\n`, { mode: 0o755 });
  }

  fs.writeFileSync(log, '');
  process.env['PATH'] = `${bin}${path.delimiter}${previous ?? ''}`;

  return {
    calls: () =>
      read(bin, 'calls.log')
        .split('\n')
        .filter((line) => line !== ''),
    failing: (fails) => (fails ? fs.writeFileSync(flag, '') : fs.rmSync(flag, { force: true })),
    restore: () => {
      process.env['PATH'] = previous;
    },
  };
}
