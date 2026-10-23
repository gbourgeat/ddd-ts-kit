import { lifecycleStatusThroughMachine } from '../../src/rules/lifecycle-status-through-machine';
import { at, BILLING, ruleTester } from '../support/rule-tester';

const AGGREGATE = `${BILLING}/domain/aggregates/invoice.aggregate.ts`;
const MACHINE = "import { invoiceLifecycle } from '../state-machines/invoice.state-machine.js';\n";

const invoice = (body: string, imports = MACHINE): string =>
  `${imports}export class Invoice extends AggregateRoot<string> {\n  private state: InvoiceState;\n\n${body}\n}`;

ruleTester.run('lifecycle-status-through-machine', lifecycleStatusThroughMachine, {
  valid: [
    at(
      AGGREGATE,
      invoice(
        "  issue(): void {\n    this.state = { ...this.state, status: invoiceLifecycle.next(this.state.status, 'issue') };\n  }",
      ),
    ),
    at(
      AGGREGATE,
      invoice(
        "  static draft(id: string): Invoice {\n    return new Invoice(id, { status: invoiceLifecycle.start('draft') });\n  }",
      ),
    ),
    at(
      AGGREGATE,
      invoice(
        '  copy(state: InvoiceState): void {\n    this.state = { total: 0, status: state.status };\n    const status = state.status;\n    this.state = { ...this.state, status };\n  }',
      ),
    ),
    at(
      AGGREGATE,
      invoice(
        "  reschedule(): void {\n    const status = invoiceLifecycle.next(this.state.status, 'reschedule');\n    this.state = { ...this.state, status };\n  }",
      ),
    ),
    at(AGGREGATE, invoice("  void(): void {\n    this.state = { ...this.state, status: 'void' };\n  }", '')),
    at(
      `${BILLING}/test/unit/invoice.aggregate.spec.ts`,
      invoice("  f(): void {\n    this.state = { status: 'void' };\n  }"),
    ),
    at(
      `${BILLING}/domain/value-objects/money.vo.ts`,
      invoice("  f(): void {\n    this.state = { status: 'void' };\n  }"),
    ),
    at(AGGREGATE, `${MACHINE}const defaults = { status: 'draft' };`),
  ],
  invalid: [
    {
      ...at(
        AGGREGATE,
        invoice(
          '  void(): void {\n    const status = InvoiceStatus.void;\n    this.state = { ...this.state, status };\n  }',
        ),
      ),
      errors: [
        {
          messageId: 'notThroughMachine',
          data: { className: 'Invoice', value: 'status', machine: 'invoiceLifecycle' },
        },
      ],
    },
    {
      ...at(
        AGGREGATE,
        invoice('  settle(next: InvoiceStatus): void {\n    this.state = { ...this.state, status: next };\n  }'),
      ),
      errors: [{ messageId: 'notThroughMachine' }],
    },
    {
      ...at(AGGREGATE, invoice("  void(): void {\n    this.state = { ...this.state, status: 'void' };\n  }")),
      errors: [
        {
          messageId: 'notThroughMachine',
          data: { className: 'Invoice', value: "'void'", machine: 'invoiceLifecycle' },
        },
      ],
    },
    {
      ...at(AGGREGATE, invoice('  pay(): void {\n    this.state.status = InvoiceStatus.paid;\n  }')),
      errors: [
        {
          messageId: 'notThroughMachine',
          data: { className: 'Invoice', value: 'InvoiceStatus.paid', machine: 'invoiceLifecycle' },
        },
      ],
    },
    {
      ...at(
        AGGREGATE,
        invoice("  settle(): void {\n    this.state = { ...this.state, 'status': this.paid ? 'paid' : 'due' };\n  }"),
      ),
      errors: [{ messageId: 'notThroughMachine' }],
    },
    {
      ...at(
        AGGREGATE,
        invoice(
          "  pay(): void {\n    this.state = { ...this.state, status: other.next(this.state.status, 'pay') };\n  }",
        ),
      ),
      errors: [{ messageId: 'notThroughMachine' }],
    },
  ],
});
