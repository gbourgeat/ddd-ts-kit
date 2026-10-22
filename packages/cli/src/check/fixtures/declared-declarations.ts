import type { FixtureFiles } from './fixture-files';
import { PATHS } from './paths';
import { source } from './source';

const IN_BILLING = '@/contexts/billing';

/** `export * from` each file, given relative to the billing context. */
const exporting = (...files: string[]): string =>
  source(...files.map((file) => `export * from '${IN_BILLING}/${file}.js';`));

/**
 * The declarations of `DECLARED_CONTEXT`, one file per role folder and the summary at the root of
 * the context, written out so that the fixtures do not prove the rule with its own code.
 */
export const DECLARED_DECLARATIONS: FixtureFiles = {
  [PATHS.BARREL]: exporting(
    'application/authorization/authorization.declarations',
    'application/commands/commands.declarations',
    'application/event-handlers/event-handlers.declarations',
    'application/integration/integration.declarations',
    'application/queries/queries.declarations',
    'application/scheduling/scheduling.declarations',
    'infrastructure/external/external.declarations',
    'infrastructure/persistence/persistence.declarations',
  ),
  [`${PATHS.BILLING}/application/authorization/authorization.declarations.ts`]: exporting(
    'application/authorization/only-issuer-voids.policy',
  ),
  [PATHS.COMMANDS_DECLARATIONS]: exporting(
    'application/commands/issue-invoice/issue-invoice.command',
    'application/commands/issue-invoice/issue-invoice.handler',
  ),
  [`${PATHS.BILLING}/application/event-handlers/event-handlers.declarations.ts`]: exporting(
    'application/event-handlers/invoice-issued.event-handler',
  ),
  [`${PATHS.BILLING}/application/integration/integration.declarations.ts`]: exporting(
    'application/integration/handlers/product-listed.integration-handler',
    'application/integration/publishers/invoice-issued.publisher',
  ),
  [`${PATHS.BILLING}/application/queries/queries.declarations.ts`]: exporting(
    'application/queries/invoices-issued/invoices-issued.handler',
    'application/queries/invoices-issued/invoices-issued.query',
  ),
  [`${PATHS.BILLING}/application/scheduling/scheduling.declarations.ts`]: exporting(
    'application/scheduling/send-reminders.job',
  ),
  [`${PATHS.BILLING}/infrastructure/external/external.declarations.ts`]: exporting(
    'infrastructure/external/in-process-price-catalog.gateway',
    'infrastructure/external/remote-payment-gateway.adapter',
  ),
  [`${PATHS.BILLING}/infrastructure/persistence/persistence.declarations.ts`]: exporting(
    'infrastructure/persistence/in-memory-invoice.repository',
  ),
};
