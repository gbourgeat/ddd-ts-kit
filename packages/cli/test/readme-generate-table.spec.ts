import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { cli, tempDir } from './helpers';

interface Kind {
  readonly name: string;
  readonly usage: string;
}

/** The flags every kind takes, named once above the table. */
const COMMON = new Set(['--term', '--allow-name', '--local-only', '--dry-run', '--force']);

const rowsOf = (readme: string): Map<string, string> =>
  new Map(
    [...readme.matchAll(/^\| `([a-z0-9-]+)`(?: \(`[a-z-]+`\))? \| (.*?) \| /gm)].map((row) => [
      row[1] ?? '',
      row[2] ?? '',
    ]),
  );

describe('the table of kinds in the README of the CLI', () => {
  const kinds = (cli(tempDir('readme-table'), 'generate', '--help', '--json').json() as { kinds: Kind[] }).kinds;

  for (const file of ['README.md', 'README.fr.md']) {
    const rows = rowsOf(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'));

    it(`${file} has a row for every kind of generate --help, and names the flags of each`, () => {
      expect(kinds.filter(({ name }) => !rows.has(name)).map(({ name }) => name)).toEqual([]);

      const missing = kinds.flatMap(({ name, usage }) => {
        const shown = rows.get(name) ?? '';
        const flags = [...new Set(usage.match(/--[a-z-]+/g) ?? [])].filter((flag) => !COMMON.has(flag));

        return /^(?:the same|les mêmes) arguments/.test(shown)
          ? []
          : flags.filter((flag) => !shown.includes(flag)).map((flag) => `${name} ${flag}`);
      });

      expect(missing).toEqual([]);
    });
  }
});
