import { describe, expect, it } from 'vitest';
import { cli, read, write } from './helpers';
import { commitAll } from './support/commit-all';
import { expectOk } from './support/expect-ok';
import { INDEX } from './support/index-invariant';
import { mergeTrunk } from './support/trunk-history';
import { twoSides } from './support/two-sides';
import { layOut, merged } from './support/two-tables-files';

const FLAT_ALIAS = '@/contexts/billing/infrastructure/persistence/billing.schema';
const FLAT = 'src/contexts/billing/infrastructure/persistence/billing.schema.ts';
const SHARED = 'src/contexts/billing/shared/infrastructure/persistence/billing.schema.ts';

function run(project: string, ...args: string[]): void {
  expectOk(cli(project, ...args));
}

/** billing stores Invoice on the base. */
function invoiceOnBase(project: string): void {
  run(project, 'generate', 'aggregate', 'billing', 'Invoice', '--term', 'Invoice=a bill');
  run(project, 'generate', 'repository', 'billing', 'Invoice');
}

/** billing laid out in modules, nothing more. */
function layOutOnly(project: string): void {
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

describe('merge-trunk on TypeORM, a hand import of a tables file the other side moved', () => {
  it('is said and left as it is, and the merge goes to its commit as on main', () => {
    const root = twoSides({
      orm: 'typeorm',
      base: invoiceOnBase,
      trunk: layOutOnly,
      branch: (project) => {
        const hand = `import { invoices as legacyInvoices } from '${FLAT_ALIAS}';\n`;

        write(
          project,
          INDEX,
          `${read(project, INDEX).replace('// /ddd-ts-kit:imports\n', `// /ddd-ts-kit:imports\n${hand}`)}\nexport const legacy = [legacyInvoices];\n`,
        );
      },
    });

    const merging = mergeTrunk(root);

    expect(merging.code, merging.stdout).toBe(0);
    expect(merging.stdout).toContain(`\`import { invoices as legacyInvoices } from '${FLAT_ALIAS}';\` names '${FLAT}'`);
    expect(read(root, INDEX)).toContain(`import { invoices as legacyInvoices } from '${FLAT_ALIAS}';`);
  });
});

describe('merge-trunk on TypeORM, a context left with two tables files', () => {
  it('says the true reason it cannot rewrite the second import, and settles the other names', () => {
    const root = twoSides({
      orm: 'typeorm',
      trunk: layOut('Payment'),
      branch: (project) => {
        run(project, 'generate', 'aggregate', 'billing', 'Payment', '--term', 'Payment=a payment');
        run(project, 'generate', 'repository', 'billing', 'Payment');
        run(project, 'generate', 'aggregate', 'shipping', 'Payment', '--term', 'Payment=a payment');
        run(project, 'generate', 'repository', 'shipping', 'Payment');

        write(
          project,
          FLAT,
          read(project, FLAT)
            .replace("tableName: 'payments'", "tableName: 'flat_payments'")
            .replace(/name: '[A-Za-z]*Payment'/, "name: 'BillingFlatPayment'"),
        );
      },
    });

    const { said } = merged(root);

    expect(said).toContain(
      `imports \`payments\` twice, and the kit cannot rewrite the second import, from '${FLAT_ALIAS}' (billing holds two tables files in the merged tree, ${SHARED} and ${FLAT})`,
    );

    expect(said).not.toContain('it is not the tables file of a context');

    expect(read(root, INDEX)).toMatch(
      /import \{[^}]*payments as shippingPayments[^}]*\} from '@\/contexts\/shipping\//,
    );
  });
});
