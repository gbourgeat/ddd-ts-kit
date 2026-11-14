import { describe, expect, it } from 'vitest';
import { cli, read, write } from './helpers';
import { commitAll } from './support/commit-all';
import { git } from './support/git';
import { INDEX, store } from './support/index-invariant';
import { loadedIndex } from './support/index-tables';
import { mergeTrunk } from './support/trunk-history';
import { twoSides } from './support/two-sides';
import { FLAT, flatPayments, followTheAdvice, layOut, merged, SHARED } from './support/two-tables-files';

const TWO =
  'the kit wrote no name in it, nor any other line of this merge: the merged tree holds two tables files for billing';

const ONE_FILE =
  'Make them one file, src/contexts/billing/shared/infrastructure/persistence/billing.schema.ts, by hand';

const CASES = [
  {
    name: 'G3r: the trunk flat, the files told apart by hand',
    trunk: flatPayments(true),
    branch: layOut('Payment'),
    bound: { payments: 'billing.flat_payments' },
  },
  {
    name: 'G3: the branch flat, the files told apart by hand',
    trunk: layOut('Payment'),
    branch: flatPayments(true),
    bound: { payments: 'billing.flat_payments' },
  },
  {
    name: 'G1i: the branch flat, Invoice in the module',
    trunk: layOut('Invoice'),
    branch: flatPayments(false),
    bound: { payments: 'billing.payments', invoices: 'billing.invoices' },
  },
  {
    name: 'G1p: the branch flat, Payment in the module',
    trunk: layOut('Payment'),
    branch: flatPayments(false),
    bound: { payments: 'billing.payments' },
  },
  {
    name: 'g0: billing alone on both sides',
    trunk: layOut('Invoice'),
    branch: (project: string) => void store(project, 'billing', 'Payment'),
    bound: { payments: 'billing.payments', invoices: 'billing.invoices' },
  },
];

describe('merge-trunk, a context left with two tables files: one side laid it out, the other stored a table flat', () => {
  it.each(CASES)(
    '$name: writes nothing, says it once with what to do, and what the index hides',
    async ({ name, trunk, branch, bound }) => {
      const root = twoSides({ orm: 'drizzle', trunk, branch });
      const byName = (text: string): string[] => (text.match(/^export \{.*$/gm) ?? []).sort();
      const sides = [...new Set([...byName(git(root, 'show', `main:${INDEX}`)), ...byName(read(root, INDEX))])].sort();
      const { previewed, said } = merged(root);
      const loaded = await loadedIndex(root);

      for (const text of [previewed, said]) {
        expect(text.split(TWO)).toHaveLength(2);
        expect(text).not.toMatch(/lists the name|did not find how to keep|now names the tables file/);
        // The sentence about the two files covers every name both declare: no other sentence of them.
        expect(text).not.toContain('is exported under no name after the merge');
      }

      expect(said).toContain(ONE_FILE);

      // A schema both files declare is kept once, never renamed in a repository or a mapper.
      if (/^(?:G1|g0)/.test(name)) {
        expect(said).toContain(`the \`billingSchema\` of ${FLAT} goes, its tables built on the one of ${SHARED}`);
      }

      expect(said.includes('where both declare one table name')).toBe(/^(?:G3|G1p)/.test(name));
      expect(said).not.toContain('several modules export `billingSchema`');
      expect(byName(read(root, INDEX))).toEqual(sides);

      // What the report calls hidden is under no name by the real load: the flat table holds the name, the schema of billing none.
      expect(loaded.bound).toMatchObject(bound);
      expect(Object.keys(loaded.bound)).not.toContain('billingSchema');
    },
  );

  it.each(CASES.filter(({ name }) => /^(?:G1i|g0)/.test(name)))(
    '$name: the advice followed, init --force settles an index that loads with every table',
    async ({ trunk, branch, bound }) => {
      const root = twoSides({ orm: 'drizzle', trunk, branch });

      merged(root);
      followTheAdvice(root);
      commitAll(root);

      const forced = cli(root, 'init', '--force');
      const loaded = await loadedIndex(root);

      expect(forced.code, forced.stdout).toBe(0);
      expect({ error: loaded.error, missing: loaded.missing }).toEqual({ error: undefined, missing: [] });
      expect(loaded.bound).toMatchObject(bound);
    },
  );
});

describe('merge-trunk, a flat file of a context laid out in modules that declares no table', () => {
  it.each([
    [
      'a file that re-exports the one of `shared/`',
      "export * from '../../shared/infrastructure/persistence/billing.schema';\n",
    ],
    ['an empty file left behind', ''],
  ])('is no second tables file: %s', (_what, flat) => {
    const root = twoSides({
      orm: 'drizzle',
      base: (project) => {
        store(project, 'billing', 'Order');
        layOut('Invoice')(project);
        write(project, FLAT, flat);
      },
      trunk: (project) => void store(project, 'shipping', 'Parcel'),
      branch: (project) => void store(project, 'returns', 'Refund'),
    });

    const previewed = mergeTrunk(root, '--dry-run').stdout;
    const merging = cli(root, 'merge-trunk', '--trunk', 'main', '--json');
    const automatic = JSON.stringify((merging.json() as { automatic?: unknown }).automatic ?? []);

    expect(merging.code, merging.stdout).toBe(0);
    // What any merge of the index says, as on main: its lines of both sides kept, and nothing of its names.
    const ofTheIndex = (text: string): string[] => text.split('\n').filter((line) => line.includes(`${INDEX}  `));

    expect(ofTheIndex(previewed).map((line) => line.trim())).toEqual([
      `${INDEX}  generated registry: the lines of both sides kept`,
    ]);

    expect(automatic).not.toMatch(/two tables files|now names|exported under no name|lists the name|wrote no name/);
  });
});
