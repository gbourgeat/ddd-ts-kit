import { describe, expect, it } from 'vitest';
import { readConfig } from '../src/config';
import { indexPicture } from '../src/generate/kinds/same-name/index-picture';
import { keepThePicture } from '../src/generate/kinds/same-name/keep-the-picture';
import { Workspace } from '../src/workspace';
import { cli, read, write } from './helpers';
import { commitAll } from './support/commit-all';
import { CONTEXTS, INDEX, store } from './support/index-invariant';
import { loadedIndex } from './support/index-tables';
import { initProject } from './support/init-project';

const tablesOf = (context: string): string => `src/contexts/${context}/infrastructure/persistence/${context}.schema.ts`;
const LEGACY = 'src/legacy/tables.ts';

function legacyTable(constant: string, table: string): string {
  return `import { pgTable, text } from 'drizzle-orm/pg-core';\n\nexport const ${constant} = pgTable('${table}', { id: text('id').primaryKey() });\n`;
}

describe('one comparison a command, on the state it ends in', () => {
  const INIT = ['init', '--orm', 'drizzle', ...CONTEXTS, '--package-manager', 'npm'];

  /** A committed Drizzle project without the preset, billing storing these aggregates. */
  function committed(...aggregates: readonly string[]): string {
    const root = initProject('--orm', 'drizzle', ...CONTEXTS, '--package-manager', 'npm');

    aggregates.forEach((aggregate) => store(root, 'billing', aggregate));
    commitAll(root);

    return root;
  }

  it.each([
    ['billing holding no table of the preset', ['Order'], { orders: 'billing.orders', accounts: 'identity.accounts' }],
    [
      'billing holding `accounts` too',
      ['Order', 'Account'],
      { accounts: 'billing.accounts', identityAccounts: 'identity.accounts' },
    ],
  ])(
    'init --force --preset identity on an existing project, %s: no index left, every table loaded',
    async (_what, aggregates, bound) => {
      const root = committed(...aggregates);
      const previewed = cli(root, ...INIT, '--force', '--preset', 'identity', '--dry-run');
      const forced = cli(root, ...INIT, '--force', '--preset', 'identity', '--json');
      const report = forced.json() as { updated?: string[]; skipped?: string[]; left?: string[] };
      const loaded = await loadedIndex(root);

      expect({ dryRun: previewed.code, forced: forced.code }).toEqual({ dryRun: 0, forced: 0 });
      expect(`${previewed.stdout}${forced.stdout}`).not.toContain('is left as it stood');
      expect(report.left).toBeUndefined();
      expect(report.skipped ?? []).not.toContain(INDEX);
      expect({ error: loaded.error, missing: loaded.missing }).toEqual({ error: undefined, missing: [] });
      expect(loaded.bound).toMatchObject(bound);
    },
  );

  it('lists a left index under `left` and `skipped` of --json, never under `updated`', () => {
    const root = committed('Order');

    write(root, LEGACY, legacyTable('legacy', 'legacy'));
    write(root, INDEX, `${read(root, INDEX)}export * from '@/legacy/tables';\n`);
    commitAll(root);

    const forced = cli(root, 'init', '--force', '--json');
    const report = forced.json() as { updated?: string[]; skipped?: string[]; left?: string[] };

    expect(forced.code).toBe(3);
    expect(report.left).toEqual([INDEX]);
    expect(report.skipped).toContain(INDEX);
    expect(report.updated ?? []).not.toContain(INDEX);
  });

  it('says where the line belongs when init --force would lose a table a line after the region keeps, and goes on once it is there', () => {
    const root = committed('Order');
    const star = "export * from '@/legacy/tables';\n";

    write(root, LEGACY, legacyTable('legacy', 'legacy'));
    write(root, INDEX, `${read(root, INDEX)}${star}`);
    commitAll(root);

    const refused = cli(root, 'init', '--force');
    const notes = refused.stdout.split('\n').filter((line) => line.startsWith(`note: ${INDEX}`));

    expect(refused.code).toBe(3);
    expect(notes).toHaveLength(1);
    expect(notes[0]).toContain(`${LEGACY}#legacy would be under no name`);
    expect(notes[0]).toContain('move the line that keeps this table inside the `// ddd-ts-kit:schemas` region');
    expect(notes[0]).toContain('Until then every `init --force` leaves the index as it stood and exits 3.');
    expect(refused.stdout).not.toContain('To write by hand');

    write(
      root,
      INDEX,
      read(root, INDEX).replace(star, '').replace('// /ddd-ts-kit:schemas\n', `${star}// /ddd-ts-kit:schemas\n`),
    );

    commitAll(root);

    expect(cli(root, 'init', '--force').code).toBe(0);
    expect(read(root, INDEX)).toContain(star);
  });
});

describe('what the comparison of a command says', () => {
  it.each(['drizzle', 'typeorm'])(
    'says on %s a table generate --force wrote out of the tables file, and leaves the index alone',
    (orm) => {
      const root = initProject('--orm', orm, ...CONTEXTS, '--package-manager', 'npm');

      store(root, 'billing', 'Order');
      store(root, 'billing', 'Crate');
      commitAll(root);

      const generated = cli(root, 'generate', 'repository', 'billing', 'Order', '--force', '--json');
      const report = generated.json() as { notes?: string[]; skipped?: string[]; left?: string[] };
      const notes = (report.notes ?? []).filter((note) => note.startsWith(INDEX));

      expect(generated.code).toBe(0);
      expect(report.left).toBeUndefined();
      expect(report.skipped ?? []).not.toContain(INDEX);
      expect(notes).toHaveLength(1);

      expect(notes[0]).toContain(
        `\`crates\` is no more in ${tablesOf('billing')}, which the command wrote again without it`,
      );

      expect(notes[0]).not.toMatch(/listed nowhere|To write by hand|left as it stood/);

      if (orm === 'typeorm') {
        expect(notes[0]).toContain('the index, which still imports it, does not compile');
      }
    },
  );

  it('names the module, not the index, as the place of a name the index takes from a module the kit does not follow', () => {
    const root = initProject('--orm', 'drizzle', ...CONTEXTS);

    write(root, INDEX, `${read(root, INDEX)}\nexport { orders } from './legacy.mjs';\n`);

    expect(indexPicture(new Workspace(root, false), readConfig(root).config).names.get('orders')).toBe(
      './legacy.mjs#orders',
    );
  });

  it('names on TypeORM the regions of the imports and of the entities when what init --force ends with lists an entity no more', () => {
    const root = initProject('--orm', 'typeorm', ...CONTEXTS, '--package-manager', 'npm');

    store(root, 'billing', 'Order');

    const ws = new Workspace(root, false);
    const config = readConfig(root).config;

    ws.update(INDEX, read(root, INDEX).replace(/^[ \t]*orders,\n/m, ''));
    keepThePicture(ws, config, 'init');

    expect(ws.notes).toEqual([expect.stringContaining('#orders would be listed no more')]);

    expect(ws.notes[0]).toContain(
      'its import inside the `// ddd-ts-kit:imports` region and its entry inside the `// ddd-ts-kit:schemas` region of `entities`',
    );

    expect(ws.read(INDEX)).toBe(read(root, INDEX));
  });

  it('gives no line to write when what a generation ends with only takes a line out of the index', () => {
    const root = initProject('--orm', 'drizzle', ...CONTEXTS, '--package-manager', 'npm');

    store(root, 'billing', 'Order');

    const ws = new Workspace(root, false);

    ws.update(INDEX, read(root, INDEX).replace(/^export \* from '@\/contexts\/billing\/.*\n/m, ''));
    keepThePicture(ws, readConfig(root).config, 'generate');

    expect(ws.notes).toEqual([
      expect.stringMatching(/is left as it stood before the command: .*#orders would be under no name\.$/),
    ]);

    expect(ws.read(INDEX)).toBe(read(root, INDEX));
  });
});
