import { processSendsCommandsOnly } from '../../src/rules/process-sends-commands-only.js';
import { at, BILLING, ruleTester } from '../support/rule-tester.js';

const PROCESS = `${BILLING}/application/processes/dunning.process.ts`;
const CLASS = 'export class DunningProcess {}';

ruleTester.run('process-sends-commands-only', processSendsCommandsOnly, {
  valid: [
    at(
      PROCESS,
      `import { CloseDunningCommand } from '../commands/close-dunning/close-dunning.command.js';\nimport { Money } from '../../domain/value-objects/money.vo.js';\nimport { invoiceIssuedV1 } from '../../../catalog/published-language/index.js';\nimport { Command } from '@ddd-ts-kit/kernel';\n${CLASS}`,
    ),
    at(
      `${BILLING}/application/processes/notes.ts`,
      `import { Invoice } from '../../domain/aggregates/invoice.aggregate.js';\n${CLASS}`,
    ),
    at(
      `${BILLING}/test/unit/dunning.process.spec.ts`,
      `import { Invoice } from '../../domain/aggregates/invoice.aggregate.js';\n${CLASS}`,
    ),
  ],
  invalid: [
    {
      ...at(
        PROCESS,
        `import { Invoice } from '../../domain/aggregates/invoice.aggregate.js';\nimport { InvoiceRepository } from '../../domain/repositories/invoice.repository.js';\nimport { Mailer } from '../ports/mailer.port.js';\nimport { KnexInvoices } from '../../infrastructure/persistence/knex-invoice.repository.js';\nimport { Pricing } from '../../domain/services/pricing.service.js';\n${CLASS}`,
      ),
      errors: [
        { messageId: 'writes', data: { target: 'domain/aggregates/' } },
        { messageId: 'writes', data: { target: 'domain/repositories/' } },
        { messageId: 'writes', data: { target: 'application/ports/' } },
        { messageId: 'writes', data: { target: 'infrastructure/' } },
        { messageId: 'writes', data: { target: 'domain/services/' } },
      ],
    },
  ],
});
