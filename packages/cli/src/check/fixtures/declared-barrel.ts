import { source } from './source.js';

/** The barrel of `DECLARED_CONTEXT`, written out so that the fixtures do not prove the rule with its own code. */
export const DECLARED_BARREL = source(
  "export * from './application/authorization/only-issuer-voids.policy.js';",
  "export * from './application/commands/issue-invoice/issue-invoice.command.js';",
  "export * from './application/commands/issue-invoice/issue-invoice.handler.js';",
  "export * from './application/event-handlers/invoice-issued.event-handler.js';",
  "export * from './application/integration/handlers/product-listed.integration-handler.js';",
  "export * from './application/integration/publishers/invoice-issued.publisher.js';",
  "export * from './application/queries/invoices-issued/invoices-issued.handler.js';",
  "export * from './application/queries/invoices-issued/invoices-issued.query.js';",
  "export * from './application/scheduling/send-reminders.job.js';",
  "export * from './infrastructure/external/in-process-price-catalog.gateway.js';",
  "export * from './infrastructure/external/remote-payment-gateway.adapter.js';",
  "export * from './infrastructure/persistence/in-memory-invoice.repository.js';",
);
