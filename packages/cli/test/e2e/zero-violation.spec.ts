import { describe, expect, it } from 'vitest';
import { cli, scaffoldEverything, tempDir, walk } from '../helpers';
import { runnerConfigFindings } from './runner-config-findings';
import { label, STACKS } from './stacks';

interface CheckJson {
  ok: boolean;
  errors: number;
  warnings: number;
  files: number;
  violations: unknown[];
}

const BILLING = [
  'CONTEXT.md',
  'billing.declarations.ts',
  'application/commands/commands.declarations.ts',
  'infrastructure/persistence/persistence.declarations.ts',
  'presentation/http/http.declarations.ts',
  'application/authorization/billing.permissions.ts',
  'application/authorization/only-issuer-cancels.policy.ts',
  'application/commands/issue-invoice/issue-invoice.command.ts',
  'application/commands/issue-invoice/issue-invoice.handler.ts',
  'application/queries/search-invoices/search-invoices.query.ts',
  'application/queries/search-invoices/search-invoices.result.ts',
  'application/queries/search-invoices/search-invoices.handler.ts',
  'application/ports/payment-gateway.port.ts',
  'application/ports/tax-rates.port.ts',
  'application/ports/search-invoices-reader.port.ts',
  'application/event-handlers/invoice-issued.event-handler.ts',
  'application/integration/publishers/invoice-issued.publisher.ts',
  'application/scheduling/cancel-stale-invoices.job.ts',
  'application/scheduling/issue-invoices-monthly.job.ts',
  'application/background/compile-overdue-statements.background-job.ts',
  'application/background/overdue-invoice-dunning-timeout.background-job.ts',
  'application/processes/overdue-invoice-dunning.process.ts',
  'domain/state-machines/invoice.state-machine.ts',
  'domain/vocabularies/invoice-status.vocabulary.ts',
  'domain/aggregates/invoice.aggregate.ts',
  'domain/entities/invoice-line.entity.ts',
  'domain/value-objects/money.vo.ts',
  'domain/events/invoice-issued.event.ts',
  'domain/errors/codes.ts',
  'domain/errors/invoice-already-issued.error.ts',
  'domain/services/pricing.service.ts',
  'domain/repositories/invoice.repository.ts',
  'infrastructure/external/remote-payment-gateway.adapter.ts',
  'infrastructure/external/remote-tax-rates.adapter.ts',
  'infrastructure/persistence/drizzle-invoice.repository.ts',
  'infrastructure/persistence/invoice.mapper.ts',
  'infrastructure/persistence/billing.schema.ts',
  'infrastructure/persistence/in-memory-search-invoices-reader.repository.ts',
  'infrastructure/anti-corruption/legacy-erp.translator.ts',
  'presentation/http/invoices.routes.ts',
  'presentation/http/invoices/issue-invoice/issue-invoice.controller.ts',
  'presentation/http/invoices/search-invoices/search-invoices.controller.ts',
  'published-language/index.ts',
  'published-language/invoice-issued.v1.integration-event.ts',
  'test/builders/invoice.builder.ts',
  'test/fakes/invoice.repository.fake.ts',
  'test/fakes/payment-gateway.fake.ts',
  'test/worlds/billing.world.ts',
  'test/integration/invoice.repository.contract.spec.ts',
  'test/unit/invoice.aggregate.spec.ts',
  'test/unit/issue-invoice.handler.spec.ts',
  'test/unit/issue-invoice.controller.spec.ts',
  'test/unit/cancel-stale-invoices.job.spec.ts',
  'test/unit/issue-invoices-monthly.job.spec.ts',
  'test/unit/compile-overdue-statements.background-job.spec.ts',
  'test/unit/overdue-invoice-dunning.process.spec.ts',
  'test/unit/overdue-invoice-dunning-timeout.background-job.spec.ts',
  'test/unit/invoice.state-machine.spec.ts',
];

const SHIPPING = [
  'application/integration/handlers/billing-invoice-issued.integration-handler.ts',
  'test/unit/billing-invoice-issued.integration-handler.spec.ts',
];

/**
 * The homogeneity guarantee: whatever the generator writes, the checker accepts.
 * A template and a rule can therefore never drift apart without this test failing.
 */
describe('a freshly generated project', () => {
  it.each(STACKS.map((stack) => [label(stack), stack] as const))('has zero violation (%s)', (_label, stack) => {
    const root = tempDir('e2e');

    scaffoldEverything(root, stack);

    const result = cli(root, 'check', '--json');
    const json = result.json() as CheckJson;

    expect(json.violations).toEqual([]);
    expect(json).toMatchObject({ ok: true, errors: 0, warnings: 0 });
    expect(json.files).toBeGreaterThan(45);
    expect(cli(root, 'docs', '--check').code).toBe(0);
    expect(result.code).toBe(0);
    // The first commit lints the configuration of the test runner too: no warning there either.
    expect(runnerConfigFindings(root)).toEqual([]);
  });

  it('holds every kind of the generator, and no token file', () => {
    const root = tempDir('e2e');

    scaffoldEverything(root);

    const inContext = (context: string): string[] =>
      walk(root, `src/contexts/${context}`).map((file) => file.replace(`src/contexts/${context}/`, ''));

    expect(inContext('billing')).toEqual(expect.arrayContaining(BILLING));
    expect(inContext('shipping')).toEqual(expect.arrayContaining(SHIPPING));
    expect(walk(root, 'src').filter((file) => /(?:\.ports|\/tokens)\.ts$/.test(file))).toEqual([]);
    expect(walk(root, 'src/apps')).toEqual(['src/apps/shipping/main.ts', 'src/apps/worker/main.ts']);
  });
});
