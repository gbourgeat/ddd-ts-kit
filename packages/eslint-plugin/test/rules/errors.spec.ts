import { errorsConstructorNotPublic } from '../../src/rules/errors-constructor-not-public.js';
import { errorsFactoryName } from '../../src/rules/errors-factory-name.js';
import { errorsThroughFactory } from '../../src/rules/errors-through-factory.js';
import { at, BILLING, ruleTester, SAMPLE_CONFIG } from '../support/rule-tester.js';

const FACTORIES = { ...SAMPLE_CONFIG, stack: { refusals: 'factories' } };
const ERROR = `${BILLING}/domain/errors/invoice.error.ts`;
const AGGREGATE = `${BILLING}/domain/aggregates/invoice.aggregate.ts`;
const HANDLER = `${BILLING}/application/commands/issue-invoice/issue-invoice.handler.ts`;
const SPEC = `${BILLING}/test/unit/invoice.error.spec.ts`;

const IMPORTED = "import { InvoiceError } from '@/contexts/billing/domain/errors/invoice.error';\n";

const concept = (members: string): string =>
  `import { ConceptError } from '@ddd-ts-kit/kernel';\nexport class InvoiceError extends ConceptError {\n${members}\n}`;

const factory = (name: string, code: string): string =>
  `static ${name}(invoiceId: string) { return InvoiceError.refusal(${code}, 'Refused.', { invoiceId }); }`;

ruleTester.run('errors-through-factory', errorsThroughFactory, {
  valid: [
    at(AGGREGATE, `${IMPORTED}throw InvoiceError.alreadyIssued(this.id);`, FACTORIES),
    at(AGGREGATE, `${IMPORTED}throw new InvoiceError(this.id);`),
    at(
      AGGREGATE,
      "import { InvariantViolation } from '@ddd-ts-kit/kernel';\nthrow new InvariantViolation('No.');",
      FACTORIES,
    ),
    at(AGGREGATE, 'class Local extends Error {}\nthrow new Local();', FACTORIES),
    at(
      AGGREGATE,
      "import type { InvoiceError } from '@/contexts/billing/domain/errors/invoice.error';\nexport type Refused = InvoiceError;",
      FACTORIES,
    ),
    at('src/platform/http/server.ts', `${IMPORTED}throw new InvoiceError('x');`, FACTORIES),
  ],
  invalid: [
    {
      ...at(AGGREGATE, `${IMPORTED}throw new InvoiceError(this.id);`, FACTORIES),
      errors: [{ messageId: 'constructed', data: { name: 'InvoiceError', context: 'billing' } }],
    },
    {
      ...at(
        HANDLER,
        "import { InvoiceNotFoundError as Missing } from '../../../domain/errors/invoice-not-found.error.js';\nreturn err(new Missing(id));",
        FACTORIES,
      ),
      errors: [{ messageId: 'constructed', data: { name: 'Missing', context: 'billing' } }],
    },
    {
      ...at(SPEC, `${IMPORTED}const error = new InvoiceError('ANY', 'ad hoc', {});`, FACTORIES),
      errors: [{ messageId: 'constructed' }],
    },
  ],
});

ruleTester.run('errors-constructor-not-public', errorsConstructorNotPublic, {
  valid: [
    at(ERROR, concept(factory('alreadyIssued', "'INVOICE_ALREADY_ISSUED'")), FACTORIES),
    at(
      ERROR,
      "export class InvoiceError extends DomainError { readonly code = 'X'; private constructor() { super('x'); } }",
      FACTORIES,
    ),
    at(ERROR, 'export class InvoiceError extends BillingError { protected constructor() { super(); } }', FACTORIES),
    at(ERROR, 'export abstract class BillingError extends DomainError {}', FACTORIES),
    at(ERROR, "export class InvoiceAlreadyIssuedError extends DomainError { readonly code = 'X'; }"),
    at(AGGREGATE, "export class InvoiceError extends DomainError { readonly code = 'X'; }", FACTORIES),
    at(SPEC, "class Probe extends DomainError { readonly code = 'X'; }", FACTORIES),
  ],
  invalid: [
    {
      ...at(ERROR, "export class InvoiceAlreadyIssuedError extends DomainError { readonly code = 'X'; }", FACTORIES),
      errors: [{ messageId: 'inheritedPublic', data: { className: 'InvoiceAlreadyIssuedError' } }],
    },
    {
      ...at(
        ERROR,
        "export class InvoiceError extends DomainError { readonly code = 'X'; constructor(id: string) { super(id); } }",
        FACTORIES,
      ),
      errors: [{ messageId: 'publicConstructor', data: { className: 'InvoiceError' } }],
    },
    {
      ...at(ERROR, 'export class InvoiceError extends ConceptError { public constructor() { super(); } }', FACTORIES),
      errors: [{ messageId: 'publicConstructor' }],
    },
  ],
});

ruleTester.run('errors-factory-name', errorsFactoryName, {
  valid: [
    at(ERROR, concept(factory('alreadyIssued', "'INVOICE_ALREADY_ISSUED'")), FACTORIES),
    at(ERROR, concept(factory('alreadyIssued', "'ALREADY_ISSUED'")), FACTORIES),
    at(ERROR, concept(factory('unknown', "'UNKNOWN_INVOICE'")), FACTORIES),
    at(ERROR, concept(factory('notAPayer', "'NOT_A_PAYER'")), FACTORIES),
    at(ERROR, concept('static is(error: unknown): boolean { return error instanceof InvoiceError; }'), FACTORIES),
    at(ERROR, concept(factory('create', "'BILLING_FAILED'"))),
    at(AGGREGATE, concept(factory('create', "'BILLING_FAILED'")), FACTORIES),
    at(
      ERROR,
      concept(
        `// ddd-ts-kit-disable-next-line errors/factory-name -- LAST_PAYER is published in the contract since 1.0\n${factory('payerRequired', "'LAST_PAYER'")}`,
      ),
      FACTORIES,
    ),
  ],
  invalid: [
    {
      ...at(ERROR, concept(factory('alreadyIssued', "'BILLING_FAILED'")), FACTORIES),
      errors: [
        {
          messageId: 'mismatch',
          data: {
            className: 'InvoiceError',
            name: 'alreadyIssued',
            code: 'BILLING_FAILED',
            expected: 'ALREADY_ISSUED or INVOICE_ALREADY_ISSUED or ALREADY_ISSUED_INVOICE',
          },
        },
      ],
    },
    ...['create', 'make', 'of', 'error1', 'Build'].map((name) => ({
      ...at(ERROR, concept(factory(name, "'INVOICE_ALREADY_ISSUED'")), FACTORIES),
      errors: [{ messageId: 'vagueName' as const, data: { className: 'InvoiceError', name } }],
    })),
    {
      ...at(ERROR, concept(factory('alreadyIssued', 'ALREADY_ISSUED')), FACTORIES),
      errors: [{ messageId: 'codeNotLiteral' }],
    },
    {
      ...at(ERROR, concept(factory('alreadyIssued', "'already-issued'")), FACTORIES),
      errors: [
        {
          messageId: 'codeFormat',
          data: {
            className: 'InvoiceError',
            name: 'alreadyIssued',
            code: 'already-issued',
            expected: 'ALREADY_ISSUED',
          },
        },
      ],
    },
    {
      ...at(ERROR, concept('static alreadyIssued() { return InvoiceError.refusal(); }'), FACTORIES),
      errors: [{ messageId: 'codeNotLiteral' }],
    },
  ],
});
