import { describe, expect, it } from 'vitest';
import { write } from './helpers';
import { behaviourPages, behaviourProject, specOf } from './support/behaviour-project';
import { pipelineAsset } from './support/pipeline-asset';

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
        '  - `#US1.02` refuses an invoice already paid',
        '- **Who may cancel an invoice**',
        '  - lets the accountant cancel',
        '- **DELETE /invoices/:id**',
        '  - answers 409 to an invoice paid',
        '- **Cancel invoice, end to end**',
        '  - answers 204 to its issuer',
        '- **Invoice a customer, acceptance**',
        '  - `#US1.02 AC1` a customer cancels an unpaid invoice',
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
    expect(page('application')).toContain('- `#US1.09 AC2` a customer reads the invoice');
    expect(page('application')).not.toContain('cancel-invoice');
    expect(page('application')).not.toContain('a customer cancels an unpaid invoice');
  });

  it('counts, at the end of each page, the titles that cite each row: the scenario of a use case on the page of its context', () => {
    expect(page('billing')).toContain('| Row | Titles |\n|---|---|\n| `#US1.02` | 2 |\n');
    expect(page('application')).toContain('| Row | Titles |\n|---|---|\n| `#US1.09` | 1 |\n');
  });
});

describe('The page of a context, a scenario whose row two use cases cite', () => {
  const root = behaviourProject({
    'src/contexts/billing/application/commands/issue-invoice/issue-invoice.handler.ts': 'export class X {}\n',
    [`${UNIT}/cancel-invoice.handler.spec.ts`]: specOf('Cancel invoice', ['#US1.04 refuses an invoice already paid']),
    [`${UNIT}/issue-invoice.handler.spec.ts`]: specOf('Issue invoice', ['#US1.04 numbers the invoice']),
    'test/acceptance/US1.acceptance.spec.ts': specOf('Invoice a customer, acceptance', [
      '#US1.04 AC1 a customer is invoiced, then cancels',
    ]),
  });

  const page = behaviourPages(root);

  it('leaves it on the page of the application, as an end-to-end spec two use cases could claim', () => {
    expect(page('billing')).not.toContain('a customer is invoiced, then cancels');
    expect(page('application')).toContain('- `#US1.04 AC1` a customer is invoiced, then cancels');
  });
});

describe('The page of a context, a policy that decides the permission of two use cases', () => {
  const root = behaviourProject({
    'src/contexts/billing/application/commands/refund-invoice/refund-invoice.handler.ts': 'export class X {}\n',
    'src/contexts/billing/billing.module.ts': [
      "builder.command(CancelInvoiceCommand).requires(billingPermissions['invoice.cancel']).handledBy(CancelInvoiceHandler);",
      "builder.command(RefundInvoiceCommand).requires(billingPermissions['invoice.cancel']).handledBy(RefundInvoiceHandler);",
      '',
    ].join('\n'),
    [`${UNIT}/cancel-invoice.handler.spec.ts`]: specOf('Cancel invoice', ['refuses an invoice already paid']),
    [`${UNIT}/refund-invoice.handler.spec.ts`]: specOf('Refund invoice', ['refunds what was paid']),
    [`${UNIT}/late-cancellation.policy.spec.ts`]: specOf('Who may cancel an invoice', ['lets the accountant cancel']),
  });

  const page = behaviourPages(root);

  it('lists its rules under the first of them, says it is shared, and names it under the other one', () => {
    expect(page('billing')).toContain(
      '### Cancel invoice (command)\n\n`unit/cancel-invoice.handler.spec.ts`, `unit/late-cancellation.policy.spec.ts` (shared with Refund invoice)\n',
    );

    expect(page('billing')).toContain(
      '### Refund invoice (command)\n\n`unit/refund-invoice.handler.spec.ts`, `unit/late-cancellation.policy.spec.ts` (listed under Cancel invoice)\n\n- **Refund invoice**\n  - refunds what was paid\n\n',
    );

    expect(page('billing').match(/lets the accountant cancel/g)).toHaveLength(1);
  });
});

describe('The pages of a context, current at every commit the hook lets through', () => {
  it('move a spec to another heading when only a source of the context changes', () => {
    const root = behaviourProject({
      [`${UNIT}/withdraw-invoice.route.spec.ts`]: specOf('DELETE /invoices/:id', ['answers 409 to an invoice paid']),
    });

    expect(behaviourPages(root)('billing')).toContain('### Cancel invoice (command)');

    write(
      root,
      'src/contexts/billing/presentation/http/withdraw-invoice.route.ts',
      "export const route = defineRoute({ method: 'DELETE', path: '/invoices/:id', operationId: 'withdrawInvoice', handle: () => new WithdrawInvoiceCommand() });\n",
    );

    expect(behaviourPages(root)('billing')).not.toContain('### Cancel invoice (command)');
  });

  it('are regenerated by the pre-commit hook when a spec, a source or the config of the kit is staged', () => {
    const hook = pipelineAsset('template', 'lefthook.yml');
    const job = hook.slice(hook.indexOf('- name: behaviour pages'), hook.indexOf('- name: commit size'));

    expect(job).toContain(
      "glob:\n        - '**/*.spec.ts'\n        - 'src/**/*.{ts,mts,cts}'\n        - 'ddd-ts-kit.config.json'\n",
    );

    expect(pipelineAsset('source', 'lefthook.yml')).toBe(hook);
  });
});
