import { describe, expect, it } from 'vitest';
import { checkJsonOf } from './check-support';
import { cli, exists, read } from './helpers';
import { billingWithPersonalInvoices } from './support/billing-with-personal-invoices';
import { expectOk } from './support/expect-ok';
import { initProject } from './support/init-project';

const BILLING = 'src/contexts/billing';
const HANDLER = `${BILLING}/application/integration/handlers/data-subject-erased.integration-handler.ts`;
const SPEC = `${BILLING}/test/unit/data-subject-erased.integration-handler.spec.ts`;

describe('generate erasure-handler: a context erases its copy when the platform announces an erasure', () => {
  it('writes the handler over the erasure of the context, declared with the event of the kernel, and its spec on the fake', () => {
    const root = billingWithPersonalInvoices(['--orm', 'knex']);

    expectOk(cli(root, 'generate', 'erasure-handler', 'billing'));

    const handler = read(root, HANDLER);

    expect(handler).toContain(
      "import { dataSubjectErasedV1, type DataSubjectErasedPayload, type IntegrationEvent } from '@ddd-ts-kit/kernel';",
    );

    expect(handler).toContain(
      "@IntegrationEventHandler(dataSubjectErasedV1, { consumer: 'billing.data-subject-erased' })",
    );

    expect(handler).toContain('  constructor(private readonly erasure: BillingPersonalDataErasure) {}');
    expect(handler).toContain('    await this.erasure.erase(event.payload.subjectId);');
    expect(read(root, SPEC)).toContain('const erasure = new FakeBillingPersonalDataErasure().holds(');

    expect(read(root, `${BILLING}/application/application.declarations.ts`)).toContain(
      'injected(DataSubjectErasedIntegrationHandler, [BillingPersonalDataErasure]);',
    );

    expect(checkJsonOf(cli(root, 'check', '--json')).violations).toEqual([]);
  });

  it('subscribes through the module file of an explicit context, the port given to the handler', () => {
    const root = billingWithPersonalInvoices(['--orm', 'knex', '--style', 'explicit']);

    expectOk(cli(root, 'generate', 'erasure-handler', 'billing'));

    expect(read(root, HANDLER)).not.toContain('@IntegrationEventHandler');

    expect(read(root, `${BILLING}/billing.module.ts`)).toContain(
      "      .on(dataSubjectErasedV1, { consumer: 'billing.data-subject-erased' })\n      .handledBy(DataSubjectErasedIntegrationHandler, [BillingPersonalDataErasure]);",
    );
  });

  it('subscribes on the hand-wired platform with the adapter wrapped, in the tenant of the work, and in a transaction behind a broker', () => {
    const tenants = billingWithPersonalInvoices(['--orm', 'knex', '--di', 'manual', '--tenancy', 'shared-table']);
    const broker = billingWithPersonalInvoices(['--orm', 'knex', '--di', 'manual', '--broker', 'rabbitmq']);

    expectOk(cli(tenants, 'generate', 'erasure-handler', 'billing'));
    expectOk(cli(broker, 'generate', 'erasure-handler', 'billing'));

    const inProcess = read(tenants, `${BILLING}/billing.module.ts`);

    expect(inProcess).toContain('new KnexBillingPersonalDataErasure(platform.persistence.database, platform.scope)');

    expect(inProcess).toContain(
      'on(dataSubjectErasedV1, (event) => dataSubjectErasedIntegrationHandler.handle(event), {',
    );

    expect(inProcess).toContain("token: 'BillingPersonalDataErasure',");

    const behindABroker = read(broker, `${BILLING}/billing.module.ts`);

    expect(behindABroker).toContain("subscribeAll(platform.subscriberFor('billing'), [");
    expect(behindABroker).toContain('consume(');
    expect(behindABroker).toContain('unitOfWork: platform.persistence.unitOfWork,');
  });

  it('refuses a context that erases nothing yet, and says how to declare what it keeps', () => {
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

    const refused = cli(root, 'generate', 'erasure-handler', 'billing');

    expect(refused.code).not.toBe(0);
    expect(refused.stderr).toContain('billing has no erasure of personal data to run');
    expect(refused.stderr).toContain('generate repository billing <Aggregate> --personal');
    expect(exists(root, HANDLER)).toBe(false);
  });

  it('refuses an event-sourced context with the way its people are erased: the key of the subject, not a table', () => {
    const root = initProject('--orm', 'knex', '--event-sourcing', 'on', '--context', 'billing:core');

    expectOk(
      cli(
        root,
        'generate',
        'aggregate',
        'billing',
        'Ledger',
        '--event-sourced',
        '--term',
        'Ledger=The payments of a customer',
        '--term',
        'Create=To open',
      ),
    );

    const refused = cli(root, 'generate', 'erasure-handler', 'billing');

    expect(refused.code).not.toBe(0);
    expect(refused.stderr).toContain('billing is event-sourced');
    expect(refused.stderr).toContain('personalData(subjectId, value)');
    expect(refused.stderr).toContain('eraseDataSubject');
    expect(refused.stderr).toContain('docs/concepts/personal-data.md');
    expect(exists(root, HANDLER)).toBe(false);
  });
});
