import { describe, expect, it } from 'vitest';
import { cli, exists, tempDir, write } from './helpers';

/** A project whose ORM tool is a stand-in that leaves a mark when it runs. */
function projectWithTool(bin: string): string {
  const root = tempDir('migration-names');

  write(root, 'ddd-ts-kit.config.json', JSON.stringify({ contexts: {} }));
  write(root, bin, "require('node:fs').writeFileSync('tool-ran', '');\n");

  return root;
}

const REFUSED = 'cannot name a migration: a migration is named in letters, digits, dashes and underscores';

describe.each([
  ['drizzle-generate', 'node_modules/drizzle-kit/bin.cjs'],
  ['knex-generate', 'node_modules/knex/bin/cli.js'],
  ['prisma-generate', 'node_modules/prisma/build/index.js'],
])('ddd-ts-kit %s --name', (command, bin) => {
  it.each(['--custom', '-x', '../evil', 'add.invoices', 'add invoices', 'ajout-évité'])(
    'refuses %s before the ORM reads it, as an option or a path',
    (name) => {
      const root = projectWithTool(bin);

      const refused = cli(root, command, `--name=${name}`);

      expect(refused.code).toBe(2);
      expect(refused.stderr).toContain(`error: "${name}" ${REFUSED}`);

      expect(refused.stderr).toContain(
        'fix: Name it by what it does, in kebab-case: `npm run db:generate add-invoices`.',
      );

      expect(exists(root, 'tool-ran')).toBe(false);
    },
  );
});

describe('ddd-ts-kit typeorm-generate <folder>/<name>', () => {
  it.each([
    ['--check', `"--check" ${REFUSED}`],
    ['migrations/-x', `"-x" ${REFUSED}`],
    ['migrations/add.invoices', `"add.invoices" ${REFUSED}`],
    [
      '../outside/add-invoices',
      '"../outside/add-invoices" cannot be the path of a migration: its folder is not one of the project.',
    ],
    [
      '/tmp/add-invoices',
      '"/tmp/add-invoices" cannot be the path of a migration: its folder is not one of the project.',
    ],
    [
      '..\\outside\\add-invoices',
      '"..\\outside\\add-invoices" cannot be the path of a migration: it is written with a backslash, and the kit reads paths with `/` only (on Windows, through WSL 2).',
    ],
  ])('refuses %s before TypeORM reads it, as an option or a place outside the project', (target, message) => {
    const root = projectWithTool('node_modules/typeorm/cli.js');

    const refused = cli(root, 'typeorm-generate', '--', target);

    expect(refused.code).toBe(2);
    expect(refused.stderr).toContain(`error: ${message}`);
    expect(exists(root, 'tool-ran')).toBe(false);
  });
});
