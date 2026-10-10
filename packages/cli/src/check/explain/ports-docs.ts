import type { RuleDoc } from '../model/rule-doc.js';

export const PORTS_DOCS: Readonly<Record<string, RuleDoc>> = {
  'ports/abstract-class': {
    why: 'A port is a contract and, at once, the injection token under which its adapter is bound: the abstract class names the dependency and carries its type. A port that holds a body, a constructor, an initializer or a hidden member is no longer a contract: a fake or a plain object cannot stand for it, and the container refuses to bind it. An interface vanishes at run time and cannot be a token, so a port file declares none. One exception is a member: `static readonly tokenKey`, the identity of a port a published package exposes. Checked in domain/repositories/*.repository.ts and application/ports/*.port.ts.',
    bad: `// application/ports/payment-gateway.port.ts
export interface PaymentGateway { charge(invoiceId: string): Promise<void> }
export abstract class Mailer {
  private readonly sent = 0;
  send(to: string): void {}
}`,
    good: `// application/ports/payment-gateway.port.ts
export abstract class PaymentGateway {
  abstract charge(invoiceId: string): Promise<void>;
}
// domain/repositories/invoice.repository.ts
export abstract class InvoiceRepository extends Repository<Invoice> {}`,
  },
  'ports/implements-never-extends': {
    why: 'An adapter says which contract it honours with `implements`, and the compiler holds it to that contract. Extending the port instead would inherit from a class that holds nothing, make the adapter a second port for the container, and is refused when the binding is registered. The rule reads the class behind @Repository, @Gateway and @Adapter, the class given to bind(P).toClass(C) or rebind(P).toClass(C), and every class of infrastructure/ that extends a class of a port file. A class bound to itself is no port and is left alone.',
    bad: `// infrastructure/persistence/knex-invoice.repository.ts
@Repository(InvoiceRepository, [Database, ExecutionScope, Clock])
export class KnexInvoiceRepository extends InvoiceRepository {}
// billing.module.ts
builder.bind(PaymentGateway).toClass(StripePaymentGateway, [PaymentSettings]);   // class StripePaymentGateway {}`,
    good: `// infrastructure/persistence/knex-invoice.repository.ts
@Repository(InvoiceRepository, [Database, ExecutionScope, Clock])
export class KnexInvoiceRepository implements InvoiceRepository {}
// infrastructure/external/stripe-payment.gateway.ts
export class StripePaymentGateway implements PaymentGateway {}`,
  },
  'ports/no-token-constant': {
    why: 'The abstract class of a port is its injection token: it names the dependency, carries its type and lets the compiler check a dependency list against a constructor. A constant beside it (a token() call, a Symbol, a string, an UPPER_SNAKE_CASE name in a list) is a second name for the same thing that nothing ties to the type, and a file of tokens is one more place to keep in step with the ports. There is one way to name a dependency: the class.',
    bad: `// application/ports/billing.ports.ts
export const INVOICE_REPOSITORY = token<InvoiceRepository>('billing.InvoiceRepository');
// application/commands/issue-invoice/issue-invoice.handler.ts
@CommandHandler(IssueInvoiceCommand, [INVOICE_REPOSITORY, CLOCK])
// billing.module.ts
builder.bind(Symbol.for('billing.PaymentGateway')).toClass(StripePaymentGateway, []);`,
    good: `// domain/repositories/invoice.repository.ts
export abstract class InvoiceRepository extends Repository<Invoice> {}
// application/commands/issue-invoice/issue-invoice.handler.ts
@CommandHandler(IssueInvoiceCommand, [InvoiceRepository, Clock])
// billing.module.ts
builder.bind(PaymentGateway).toClass(StripePaymentGateway, [PaymentSettings]);`,
  },
  'ports/no-concrete-dependency': {
    why: 'A dependency list says what a class needs, not who provides it. A list that names an adapter of infrastructure/ or a fake of test/fakes/ ties the use case to one implementation: the adapter can no longer be replaced at the composition root, and a test can no longer give its fake. The list names the port, the constructor parameter is typed by it, and the choice of the implementation stays in one place.',
    bad: `// application/commands/issue-invoice/issue-invoice.handler.ts
import { KnexInvoiceRepository } from '#src/contexts/billing/infrastructure/persistence/knex-invoice.repository.js';

@CommandHandler(IssueInvoiceCommand, [KnexInvoiceRepository, Clock])`,
    good: `// application/commands/issue-invoice/issue-invoice.handler.ts
import { InvoiceRepository } from '#src/contexts/billing/domain/repositories/invoice.repository.js';

@CommandHandler(IssueInvoiceCommand, [InvoiceRepository, Clock])`,
  },
  'ports/value-import': {
    why: 'A port named in a dependency list or given to bind is used as a value: the class itself is looked up in the container. `import type` erases the import when the file is compiled, so the list would hold undefined at run time, or the file would not compile. The import of a token is a plain import; `import type` stays right for a class that only types a parameter.',
    bad: `import type { InvoiceRepository } from '#src/contexts/billing/domain/repositories/invoice.repository.js';
import { type Clock } from '@ddd-ts-kit/kernel';

@CommandHandler(IssueInvoiceCommand, [InvoiceRepository, Clock])`,
    good: `import { Clock } from '@ddd-ts-kit/kernel';
import { InvoiceRepository } from '#src/contexts/billing/domain/repositories/invoice.repository.js';

@CommandHandler(IssueInvoiceCommand, [InvoiceRepository, Clock])`,
  },
};
