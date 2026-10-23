import { source } from './source';

/**
 * The declarations of `DECLARED_CONTEXT` as the generator wrote them up to 0.84, all in
 * `billing.declarations.ts`: one `export *` per role file, sorted by path, and no registration,
 * since no constructor of the context takes anything. Written out, not rendered by the kit.
 */
export const SINGLE_FILE_DECLARATIONS = source(
  ...[
    'application/authorization/only-issuer-voids.policy',
    'application/commands/issue-invoice/issue-invoice.command',
    'application/commands/issue-invoice/issue-invoice.handler',
    'application/event-handlers/invoice-issued.event-handler',
    'application/integration/handlers/product-listed.integration-handler',
    'application/integration/publishers/invoice-issued.publisher',
    'application/queries/invoices-issued/invoices-issued.handler',
    'application/queries/invoices-issued/invoices-issued.query',
    'application/scheduling/send-reminders.job',
    'infrastructure/external/in-process-price-catalog.gateway',
    'infrastructure/external/remote-payment-gateway.adapter',
    'infrastructure/persistence/in-memory-invoice.repository',
  ].map((file) => `export * from '@/contexts/billing/${file}.js';`),
);
