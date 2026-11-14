import { describe, expect, it } from 'vitest';
import { cli, read, write } from './helpers';
import { commitAll } from './support/commit-all';
import { INDEX, store } from './support/index-invariant';
import { loadedIndex } from './support/index-tables';
import { mergeTrunk } from './support/trunk-history';
import { twoSides } from './support/two-sides';
import { FLAT, flatPayments, layOut, makeThemOneFile, merged, SHARED } from './support/two-tables-files';

describe('merge-trunk, two tables files of one context that declare no name in common', () => {
  it('g4: does what any merge does where nothing is shared, and says what main says', () => {
    const root = twoSides({ orm: 'drizzle', trunk: layOut('Invoice'), branch: flatPayments(true) });
    const previewed = mergeTrunk(root, '--dry-run').stdout;
    const result = cli(root, 'merge-trunk', '--trunk', 'main', '--json');
    const report = result.json() as { automatic?: { file: string; how: string }[] };
    const ofTheIndex = (report.automatic ?? []).filter(({ file }) => file === INDEX).map(({ how }) => how);

    // What main prints of the index in this merge, written out: its lines of both sides kept, nothing of its names.
    expect(previewed.split('\n').filter((line) => line.includes(`${INDEX}  `))).toEqual([
      `  ${INDEX}  generated registry: the lines of both sides kept`,
    ]);

    expect(ofTheIndex).toEqual(['generated registry: the lines of both sides kept']);
  });
});

describe('merge-trunk, two tables files that declare one table name each', () => {
  it.each([
    { name: 'G3r: the trunk flat', trunk: flatPayments(true), branch: layOut('Payment'), keeper: 'flat' as const },
    { name: 'G3: the branch flat', trunk: layOut('Payment'), branch: flatPayments(true), keeper: 'shared' as const },
  ])(
    "$name: the sentence names the file of the trunk that keeps the name, and followed, binds the trunk's table",
    async ({ trunk, branch, keeper }) => {
      const root = twoSides({ orm: 'drizzle', trunk, branch });
      const { said } = merged(root);
      const ofTheTrunk = keeper === 'flat' ? FLAT : SHARED;

      expect(said).toContain('and both declare `payments`.');

      expect(said).toContain(
        `the one of the two files the trunk's index exports it from keeps it (\`payments\`: ${ofTheTrunk}, which the trunk's index exports as \`payments\`)`,
      );

      const renamed = keeper === 'flat' ? 'sharedPayments' : 'flatPayments';

      makeThemOneFile(root, { keeper, renamed });
      commitAll(root);

      const forced = cli(root, 'init', '--force');
      const loaded = await loadedIndex(root);

      expect(forced.code, forced.stdout).toBe(0);
      expect({ error: loaded.error, missing: loaded.missing }).toEqual({ error: undefined, missing: [] });

      expect(loaded.bound).toMatchObject(
        keeper === 'flat'
          ? { payments: 'billing.flat_payments', [renamed]: 'billing.payments' }
          : { payments: 'billing.payments', [renamed]: 'billing.flat_payments' },
      );

      const repository =
        keeper === 'flat'
          ? 'src/contexts/billing/invoicing/infrastructure/persistence/drizzle-payment.repository.ts'
          : 'src/contexts/billing/infrastructure/persistence/drizzle-payment.repository.ts';

      expect(read(root, repository)).toMatch(new RegExp(`\\b${renamed}\\b`));
    },
  );
});

describe('merge-trunk, two tables files, the trunk exporting the name of one of them under another name', () => {
  it('G5: names the file the trunk exports it from and the name it gives it, and followed, every table loads', async () => {
    const root = twoSides({
      orm: 'drizzle',
      trunk: (project) => {
        store(project, 'shipping', 'Payment');
        layOut('Payment')(project);
      },
      branch: (project) => {
        store(project, 'billing', 'Payment');

        write(
          project,
          FLAT,
          read(project, FLAT)
            .replaceAll('billingSchema', 'billingLedgerSchema')
            .replace("table('payments'", "table('flat_payments'"),
        );
      },
    });

    const { previewed, said } = merged(root);
    const keeps = `(\`payments\`: ${SHARED}, which the trunk's index exports as \`billingPayments\`)`;

    expect(previewed).toContain(keeps);
    expect(said).toContain(keeps);

    makeThemOneFile(root, { keeper: 'shared', renamed: 'flatPayments' });
    commitAll(root);

    const forced = cli(root, 'init', '--force');
    const loaded = await loadedIndex(root);

    expect(forced.code, forced.stdout).toBe(0);
    expect({ error: loaded.error, missing: loaded.missing }).toEqual({ error: undefined, missing: [] });

    expect(loaded.tables).toEqual(
      expect.arrayContaining(['billing.payments', 'billing.flat_payments', 'shipping.payments']),
    );

    expect(loaded.bound).toMatchObject({ flatPayments: 'billing.flat_payments' });
  });
});
