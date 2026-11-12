import { describe, expect, it } from 'vitest';
import { cli, read } from './helpers';
import { mergedByGit, names } from './support/merged-by-git';
import { mergeTrunk } from './support/trunk-history';

const PAYMENTS = { 'migrations/1760500000000-AddPayments.ts': 'export class AddPayments1760500000000 {}\n' };

/** The file of the branch once landed, and the 13 digits its class now ends with. */
function landed(root: string): { file: string; text: string; stamp: string } {
  const file = names(root).find((entry) => !entry.endsWith('AddPayments.ts') && entry !== 'helpers.ts') ?? '';
  const text = read(root, `migrations/${file}`);

  return { file, text, stamp: /class \w*?(\d{13})\b/.exec(text.replace(/^\/\/.*$/gm, ''))?.[1] ?? '' };
}

function reportedIn(root: string): unknown {
  return cli(root, 'verify-merge', '--since', 'main', '--json').json();
}

describe('merge-trunk --to-land without a merge, the class of a TypeORM migration', () => {
  it('renames the class wherever the code names it and its name property, and nothing else that holds the same letters', () => {
    const root = mergedByGit('typeorm', {
      ours: {
        'migrations/1760000000000-AddInvoices.ts': [
          '// export class AddInvoices1760000000000 was written by `typeorm migration:create`',
          'export class AddInvoices1760000000000Helper {}',
          'class AddInvoices1760000000000 {',
          "  name: string = 'AddInvoices1760000000000';",
          "  up = (runner) => runner.query(`INSERT INTO notes VALUES ('AddInvoices1760000000000 ran')`);",
          "  label = 'AddInvoices1760000000000';",
          '}',
          'export { AddInvoices1760000000000 };',
          'export default AddInvoices1760000000000;',
          '',
        ].join('\n'),
      },
      theirs: PAYMENTS,
    });

    const result = mergeTrunk(root, '--to-land');
    const { text, stamp } = landed(root);

    expect(Number(stamp)).toBeGreaterThan(1760500000000);

    expect(text.split('\n').slice(0, 9)).toEqual([
      '// export class AddInvoices1760000000000 was written by `typeorm migration:create`',
      'export class AddInvoices1760000000000Helper {}',
      `class AddInvoices${stamp} {`,
      `  name: string = 'AddInvoices${stamp}';`,
      "  up = (runner) => runner.query(`INSERT INTO notes VALUES ('AddInvoices1760000000000 ran')`);",
      "  label = 'AddInvoices1760000000000';",
      '}',
      `export { AddInvoices${stamp} };`,
      `export default AddInvoices${stamp};`,
    ]);

    expect(result.stdout).toContain('correct its row in `migrations` (`timestamp`, and `name`, the class)');
  });

  it('orders by the stamp of the class, not by the file: a file named otherwise is reported and its class restamped', () => {
    const unnamed = mergedByGit('typeorm', {
      ours: { 'migrations/AddInvoices.ts': 'export class AddInvoices1760000000000 {}\n' },
      theirs: PAYMENTS,
    });

    const reported = reportedIn(unnamed);
    const result = mergeTrunk(unnamed, '--to-land');

    expect(reported).toMatchObject({
      migrations: [{ migration: 'AddInvoices', trunkLast: '1760500000000-AddPayments' }],
    });

    expect(landed(unnamed).file).toBe('AddInvoices.ts');
    expect(Number(landed(unnamed).stamp)).toBeGreaterThan(1760500000000);
    expect(result.stdout).toMatch(/AddInvoices given the stamp \d{13} in its class, after the last migration/);
    expect(reportedIn(unnamed)).toMatchObject({ migrations: [] });
  });

  it('reads a file name without separator, and no file that declares no stamped class, on either side', () => {
    const dotted = mergedByGit('typeorm', {
      ours: { 'migrations/1760600000000.NoSeparator.ts': 'export class NoSeparator1760000002000 {}\n' },
      theirs: PAYMENTS,
    });

    const helper = mergedByGit('typeorm', {
      ours: { 'migrations/1760600000000-AddInvoices.ts': 'export class AddInvoices1760600000000 {}\n' },
      theirs: { ...PAYMENTS, 'migrations/helpers.ts': 'export const timestamps = () => undefined;\n' },
    });

    const reported = [dotted, helper].map(reportedIn);

    mergeTrunk(dotted, '--to-land');

    expect(reported).toMatchObject([{ migrations: [{ migration: '1760600000000.NoSeparator' }] }, { migrations: [] }]);
    expect(landed(dotted).file).toBe(`${landed(dotted).stamp}.NoSeparator.ts`);
    expect(Number(landed(dotted).stamp)).toBeGreaterThan(1760500000000);
  });
});
