import { describe, expect, it } from 'vitest';
import { behaviourPages, behaviourProject, specOf } from './support/behaviour-project';

const UNIT = 'src/contexts/billing/test/unit';
const INTEGRATION = 'src/contexts/billing/test/integration';

describe('The page of a context, one heading per use case', () => {
  const root = behaviourProject({
    [`${UNIT}/cancel-invoice.handler.spec.ts`]: specOf('Cancel invoice', ['#US1.02 refuses an invoice already paid']),
    [`${UNIT}/late-cancellation.policy.spec.ts`]: specOf('Who may cancel an invoice', ['lets the accountant cancel']),
    [`${UNIT}/withdraw-invoice.route.spec.ts`]: specOf('DELETE /invoices/:id', ['answers 409 to an invoice paid']),
    'test/e2e/cancel-invoice.e2e.spec.ts': specOf('Cancel invoice, end to end', ['answers 204 to its issuer']),
    'test/acceptance/US1.acceptance.spec.ts': specOf('Invoice a customer, acceptance', [
      '#US1.02 AC1 a customer cancels an unpaid invoice',
      '#US1.09 AC2 a customer reads the invoice',
    ]),
    [`${UNIT}/invoice.aggregate.spec.ts`]: specOf('Invoice', ['is never issued twice']),
    [`${UNIT}/invoice-total.vo.spec.ts`]: specOf('InvoiceTotal', ['adds the lines of the invoice']),
    [`${UNIT}/invoice-total.vo.properties.spec.ts`]: specOf('InvoiceTotal', ['keeps a positive total for any line']),
    [`${UNIT}/invoice-issued.event-handler.spec.ts`]: specOf('When invoice issued', ['mails the invoice']),
    [`${INTEGRATION}/invoice.repository.contract.spec.ts`]: specOf('Invoice repository', ['finds what it saved']),
    'test/e2e/journey-billing.e2e.spec.ts': specOf('Billing, a journey', ['issues then cancels an invoice']),
  });

  const page = behaviourPages(root);

  it('holds the handler, the policy, the route, the end-to-end spec and the scenarios that cite its rows of a use case under its name', () => {
    expect(page('billing')).toContain(
      [
        '## Use cases',
        '',
        '### Cancel invoice (command)',
        '',
        '`unit/cancel-invoice.handler.spec.ts`, `unit/late-cancellation.policy.spec.ts`, `unit/withdraw-invoice.route.spec.ts`, `test/e2e/cancel-invoice.e2e.spec.ts`, `test/acceptance/US1.acceptance.spec.ts`',
        '',
        '- **Cancel invoice**',
        '  - refuses an invoice already paid',
        '- **Who may cancel an invoice**',
        '  - lets the accountant cancel',
        '- **DELETE /invoices/:id**',
        '  - answers 409 to an invoice paid',
        '- **Cancel invoice, end to end**',
        '  - answers 204 to its issuer',
        '- **Invoice a customer, acceptance**',
        '  - a customer cancels an unpaid invoice',
        '',
        '## Model',
      ].join('\n'),
    );
  });

  it('gives each part of the model and each reaction a heading of its own, a value object with the properties of its spec', () => {
    expect(page('billing')).toContain('### Invoice (aggregate)\n\n`unit/invoice.aggregate.spec.ts`\n');

    expect(page('billing')).toContain(
      '### Invoice total (value object)\n\n`unit/invoice-total.vo.properties.spec.ts`, `unit/invoice-total.vo.spec.ts`\n',
    );

    expect(page('billing')).toContain(
      '## Reactions\n\n### Invoice issued (event handler)\n\n`unit/invoice-issued.event-handler.spec.ts`\n',
    );
  });

  it('leaves a spec that fits no use case under its directory, and on the page of the application what serves none', () => {
    expect(page('billing')).toContain(
      '## Integration specs\n\n### invoice.repository (contract), in integration\n\n`integration/invoice.repository.contract.spec.ts`\n\n- **Invoice repository**\n  - finds what it saved\n',
    );

    expect(page('application')).toContain('### journey-billing (end to end), in e2e');
    expect(page('application')).toContain('- a customer reads the invoice');
    expect(page('application')).not.toContain('cancel-invoice');
    expect(page('application')).not.toContain('a customer cancels an unpaid invoice');
  });
});
