import { BILLING, SAMPLE_CONFIG } from './rule-tester';

export const DECLARED = { ...SAMPLE_CONFIG, stack: { style: 'declared', assembly: 'barrel' } };
export const EXPLICIT = { ...SAMPLE_CONFIG, stack: { style: 'explicit' } };

export const MODULE = `${BILLING}/billing.module.ts`;
export const COMMAND = `${BILLING}/application/commands/issue-invoice/issue-invoice.command.ts`;
export const QUERY = `${BILLING}/application/queries/search-invoices/search-invoices.query.ts`;
export const HANDLER = `${BILLING}/application/commands/issue-invoice/issue-invoice.handler.ts`;
export const QUERY_HANDLER = `${BILLING}/application/queries/search-invoices/search-invoices.handler.ts`;
export const INTEGRATION_HANDLER = `${BILLING}/application/integration/handlers/catalog-product-listed.integration-handler.ts`;
export const EVENT_HANDLER = `${BILLING}/application/event-handlers/invoice-issued.event-handler.ts`;
export const PUBLISHER = `${BILLING}/application/integration/publishers/invoice-issued.publisher.ts`;
export const POLICY = `${BILLING}/application/authorization/only-issuer-voids.policy.ts`;
export const PERMISSIONS = `${BILLING}/application/authorization/billing.permissions.ts`;
export const PORT = `${BILLING}/application/ports/payment-gateway.port.ts`;
export const JOB = `${BILLING}/application/scheduling/send-reminders.job.ts`;
export const REPOSITORY = `${BILLING}/infrastructure/persistence/knex-invoice.repository.ts`;
export const GATEWAY = `${BILLING}/infrastructure/external/in-process-price-catalog.gateway.ts`;
export const ADAPTER = `${BILLING}/infrastructure/external/remote-payment-provider.adapter.ts`;
export const MAPPER = `${BILLING}/infrastructure/persistence/invoice.mapper.ts`;
export const ROUTE = `${BILLING}/presentation/http/issue-invoice.route.ts`;
export const AGGREGATE = `${BILLING}/domain/aggregates/invoice.aggregate.ts`;
export const EVENT = `${BILLING}/domain/events/invoice-issued.event.ts`;
export const SPEC = `${BILLING}/test/unit/issue-invoice.handler.spec.ts`;

export const DECLARATIONS = '@ddd-ts-kit/kernel/declarations';

/** A source that imports these names from the declarations entry of the kernel. */
export const declaring = (names: string, code: string): string =>
  `import { ${names} } from '${DECLARATIONS}';\n${code}`;
