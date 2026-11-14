import { describe, expect, it } from 'vitest';
import { cli, read, write } from './helpers';
import { commitAll } from './support/commit-all';
import { expectOk } from './support/expect-ok';
import { INDEX, store } from './support/index-invariant';
import { mergeTrunk } from './support/trunk-history';
import { twoSides } from './support/two-sides';
import { merged } from './support/two-tables-files';

const FLAT = 'src/contexts/billing/infrastructure/persistence/billing.schema.ts';
const SHARED = 'src/contexts/billing/shared/infrastructure/persistence/billing.schema.ts';
const FLAT_ALIAS = '@/contexts/billing/infrastructure/persistence/billing.schema';

/** What no merge here may say: the kit writes nothing in the index, nor settles a name. */
const WRITTEN = /now names the tables file|lists the name|lists the entity|imported the entity|the line of `/;

function run(project: string, ...args: string[]): void {
  expectOk(cli(project, ...args));
}

/** billing laid out in modules, `invoicing` its first module. */
function layOutBilling(project: string): void {
  commitAll(project);

  run(
    project,
    'generate',
    'module',
    'billing',
    'invoicing',
    '--purpose',
    'Bills the orders.',
    '--term',
    'Invoicing=billing the orders',
  );

  commitAll(project);
  run(project, 'context-layout', 'billing');
}

/** The sentence of a line of the index that names the place the merged tree no longer holds. */
function staleSentence(line: string): string {
  return `\`${line}\` names '${FLAT}', which the merged tree no longer holds: billing's tables file is now '${SHARED}'; write that path in the line.`;
}

const ONCE =
  'the kit wrote no name in it, nor any other line of this merge, while a line names a place the merged tree no longer holds';

describe.each(['trunk', 'branch'] as const)(
  'merge-trunk, billing laid out in modules on the %s while the other side writes for its flat tables file',
  (laidOut) => {
    it('on Drizzle, a name shared with shipping: says each line that names the flat place, and writes nothing', () => {
      const flat = (project: string): void => void store(project, 'shipping', 'Order');

      const root = twoSides({
        orm: 'drizzle',
        base: (project) => void store(project, 'billing', 'Order'),
        trunk: laidOut === 'trunk' ? layOutBilling : flat,
        branch: laidOut === 'branch' ? layOutBilling : flat,
      });

      const { previewed, said } = merged(root);
      const sentence = staleSentence(`export { orders } from '${FLAT_ALIAS}';`);

      for (const text of [previewed, said]) {
        expect(text).toContain(sentence);
        expect(text).toContain(ONCE);
        expect(text).not.toMatch(WRITTEN);
      }

      expect(read(root, INDEX)).toContain(`export { orders } from '${FLAT_ALIAS}';`);
    });

    it('on Drizzle, no name shared: the index merges as on main, nothing said of it', () => {
      const flat = (project: string): void => void store(project, 'billing', 'Payment');

      const root = twoSides({
        orm: 'drizzle',
        base: (project) => void store(project, 'billing', 'Order'),
        trunk: laidOut === 'trunk' ? layOutBilling : flat,
        branch: laidOut === 'branch' ? layOutBilling : flat,
      });

      const { previewed, said } = merged(root);

      for (const text of [previewed, said]) {
        expect(text).not.toMatch(WRITTEN);
        expect(text).not.toContain(ONCE);
      }
    });

    it.each([false, true])(
      'on TypeORM, a name shared with shipping: %s: says the import of the flat place, and writes nothing',
      (shared) => {
        const flat = (project: string): void => {
          run(project, 'generate', 'aggregate', 'billing', 'Payment', '--term', 'Payment=a payment');
          run(project, 'generate', 'repository', 'billing', 'Payment');
        };

        const root = twoSides({
          orm: 'typeorm',
          base: (project) => {
            run(project, 'generate', 'aggregate', 'billing', 'Invoice', '--term', 'Invoice=a bill');
            run(project, 'generate', 'repository', 'billing', 'Invoice');

            if (shared) {
              run(project, 'generate', 'aggregate', 'shipping', 'Payment', '--term', 'Payment=a payment');
              run(project, 'generate', 'repository', 'shipping', 'Payment');
            }
          },
          trunk: laidOut === 'trunk' ? layOutBilling : flat,
          branch: laidOut === 'branch' ? layOutBilling : flat,
        });

        const { previewed, said } = merged(root);
        const line = `import { invoices, ${shared ? 'payments as billingPayments' : 'payments'} } from '${FLAT_ALIAS}';`;

        for (const text of [previewed, said]) {
          expect(text).toContain(staleSentence(line));
          expect(text).toContain(ONCE);
          expect(text).not.toMatch(WRITTEN);
          expect(text).not.toContain('twice, and the kit cannot rewrite the second import');
        }

        expect(read(root, INDEX)).toContain(line);
      },
    );
  },
);

describe('merge-trunk, a line of the index the kit does not count', () => {
  it('a line a comment holds is said by nothing', () => {
    const root = twoSides({
      orm: 'drizzle',
      base: (project) => void store(project, 'billing', 'Order'),
      trunk: layOutBilling,
      branch: (project) => {
        write(project, INDEX, `${read(project, INDEX)}/*\nexport { orders } from '${FLAT_ALIAS}';\n*/\n`);
      },
    });

    const merging = mergeTrunk(root);

    expect(merging.code, merging.stdout).toBe(0);
    expect(merging.stdout).not.toContain(ONCE);
    expect(merging.stdout).not.toMatch(WRITTEN);
  });
});
