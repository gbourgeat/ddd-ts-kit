import { describe, expect, it } from 'vitest';
import { checkJsonOf } from './check-support';
import { cli, exists, read, type CliResult } from './helpers';
import { billingWithPersonalInvoices } from './support/billing-with-personal-invoices';
import { expectOk } from './support/expect-ok';
import { initProject } from './support/init-project';

const BILLING = 'src/contexts/billing';
const PERSISTENCE = `${BILLING}/infrastructure/persistence`;
const DECLARATION = `${PERSISTENCE}/invoice.personal-fields.ts`;
const COPIES = 'src/platform/privacy/data-subject-copies.ts';
const PERSONAL = ['--personal', 'customer_email,customer_name'];

function adapterOf(root: string, prefix: string): string {
  return read(root, `${PERSISTENCE}/${prefix}-billing-personal-data-erasure.repository.ts`);
}

describe('the wiring of the erasure, in each family', () => {
  it('binds the port to the adapter in the module file of an explicit context, and lists the port among the copies', () => {
    const root = billingWithPersonalInvoices(['--orm', 'knex', '--style', 'explicit']);

    expect(read(root, `${BILLING}/billing.module.ts`)).toContain(
      "builder.bind(BillingPersonalDataErasure).toClass(KnexBillingPersonalDataErasure, [KnexContext]).as('repository');",
    );

    expect(adapterOf(root, 'knex')).not.toContain('@Repository');
    expect(read(root, COPIES)).toContain('  BillingPersonalDataErasure,\n');
  });

  it('instantiates the adapter from the platform where the contexts are wired by hand, wrapped like any other adapter', () => {
    const root = billingWithPersonalInvoices(['--orm', 'knex', '--di', 'manual']);
    const copies = read(root, COPIES);

    expect(copies).toContain(
      "import { KnexBillingPersonalDataErasure } from '@/contexts/billing/infrastructure/persistence/knex-billing-personal-data-erasure.repository';",
    );

    expect(copies).toContain('(platform) =>');
    expect(copies).toContain('platform.adapter(new KnexBillingPersonalDataErasure(platform.persistence.database), {');
    expect(copies).toContain("token: 'BillingPersonalDataErasure'");
    expect(read(root, `${BILLING}/billing.module.ts`)).not.toContain('PersonalDataErasure');
    expect(checkJsonOf(cli(root, 'check', '--json')).violations).toEqual([]);
  });
});

describe('init --force keeps the erasure of each context among the copies the platform erases', () => {
  it('lists the port again on tsyringe, and the factory again where the platform is wired by hand', () => {
    const tsyringe = billingWithPersonalInvoices(['--orm', 'knex']);
    const byHand = billingWithPersonalInvoices(['--orm', 'knex', '--di', 'manual', '--tenancy', 'shared-table']);

    expectOk(cli(tsyringe, 'init', '--force', '--orm', 'knex'));
    expectOk(cli(byHand, 'init', '--force', '--orm', 'knex', '--di', 'manual', '--tenancy', 'shared-table'));

    expect(read(tsyringe, COPIES)).toContain(
      '  // ddd-ts-kit:copies\n  BillingPersonalDataErasure,\n  // /ddd-ts-kit:copies',
    );

    expect(read(tsyringe, COPIES).match(/BillingPersonalDataErasure/g)).toHaveLength(2);

    expect(read(byHand, COPIES)).toContain(
      'platform.adapter(new KnexBillingPersonalDataErasure(platform.persistence.database, platform.scope), {',
    );
  });
});

describe('what --personal refuses before anything is written', () => {
  const refused = (root: string, ...flags: string[]): CliResult => {
    const result = cli(root, 'generate', 'repository', 'billing', 'Invoice', ...flags);

    expect(result.code).not.toBe(0);
    expect(exists(root, DECLARATION)).toBe(false);

    return result;
  };

  it('a project without the privacy folder, and a storage no erasure adapter of the kit reads', () => {
    const off = initProject('--privacy', 'off');
    const memory = initProject('--orm', 'none', '--privacy', 'on');

    for (const root of [off, memory]) {
      expectOk(
        cli(
          root,
          'generate',
          'context',
          'billing',
          '--classification',
          'core',
          '--purpose',
          'Bills.',
          '--term',
          'Invoice=A bill',
        ),
      );

      expectOk(cli(root, 'generate', 'aggregate', 'billing', 'Invoice'));
    }

    expect(refused(off, ...PERSONAL).stderr).toContain('init --force --privacy on');
    expect(refused(memory, ...PERSONAL).stderr).toContain('--orm none');
  });

  it('a column that is not one, a column of its own, a subject that is personal data, a mode that does not exist, a subject alone', () => {
    const root = initProject('--orm', 'knex');

    expectOk(
      cli(
        root,
        'generate',
        'context',
        'billing',
        '--classification',
        'core',
        '--purpose',
        'Bills.',
        '--term',
        'Invoice=A bill',
      ),
    );

    expectOk(cli(root, 'generate', 'aggregate', 'billing', 'Invoice'));

    expect(refused(root, '--personal', 'Customer Email').stderr).toContain('is not a column name');
    expect(refused(root, '--personal', 'customer_email,version').stderr).toContain('keeps for its own needs');
    expect(refused(root, '--personal', 'customer_email,customer_email').stderr).toContain('twice');
    expect(refused(root, '--personal', 'email', '--subject', 'email').stderr).toContain('also listed in --personal');
    expect(refused(root, '--personal', 'email', '--erasure', 'forget').stderr).toContain('not a mode of erasure');
    expect(refused(root, '--subject', 'customer_id').stderr).toContain('go with --personal');
  });
});
