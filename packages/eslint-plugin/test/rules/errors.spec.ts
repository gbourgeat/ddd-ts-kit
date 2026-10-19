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

const NAMED = { ...SAMPLE_CONFIG, stack: { refusals: 'named' } };
const REFUSAL = `${BILLING}/domain/errors/invoice-already-issued.error.ts`;

const IMPORTED_REFUSAL =
  "import { InvoiceAlreadyIssued } from '@/contexts/billing/domain/errors/invoice-already-issued.error';\n";

const refusal = (members: string, name = 'InvoiceAlreadyIssued'): string =>
  `import { DomainRefusal } from '@ddd-ts-kit/kernel';\nimport { BillingCodes } from './codes';\nexport class ${name} extends DomainRefusal {\nreadonly code = BillingCodes.${name};\n${members}\n}`;

const named = (name: string, owner = 'InvoiceAlreadyIssued'): string =>
  `static ${name}(invoiceId: string) { return ${owner}.refusal('Refused.', { invoiceId }); }`;

ruleTester.run('errors-through-factory under named', errorsThroughFactory, {
  valid: [
    at(AGGREGATE, `${IMPORTED_REFUSAL}throw InvoiceAlreadyIssued.forInvoice(this.id);`, NAMED),
    at(REFUSAL, refusal(named('forInvoice')), NAMED),
    at(
      AGGREGATE,
      "import { InvariantViolation } from '@ddd-ts-kit/kernel';\nthrow new InvariantViolation('No.');",
      NAMED,
    ),
    at(SPEC, "class Probe extends DomainRefusal { readonly code = 'X'; }\nthrow new Probe('x');"),
    at(SPEC, "class Probe extends DomainRefusal { readonly code = 'X'; }\nthrow new Probe('x');", FACTORIES),
    at('src/platform/http/server.ts', `${IMPORTED_REFUSAL}throw new InvoiceAlreadyIssued('x');`, NAMED),
  ],
  invalid: [
    {
      ...at(AGGREGATE, `${IMPORTED_REFUSAL}throw new InvoiceAlreadyIssued('Refused.');`, NAMED),
      errors: [{ messageId: 'constructedRefusal', data: { name: 'InvoiceAlreadyIssued', context: 'billing' } }],
    },
    {
      ...at(
        REFUSAL,
        refusal("static forInvoice(invoiceId: string) { return new InvoiceAlreadyIssued('Refused.', { invoiceId }); }"),
        NAMED,
      ),
      errors: [{ messageId: 'constructedRefusal', data: { name: 'InvoiceAlreadyIssued', context: 'billing' } }],
    },
    {
      ...at(
        SPEC,
        "const probe = () => new Probe('x');\nclass Probe extends DomainRefusal { readonly code = 'X'; }",
        NAMED,
      ),
      errors: [{ messageId: 'constructedRefusal', data: { name: 'Probe', context: 'billing' } }],
    },
    {
      ...at(SPEC, `${IMPORTED}const error = new InvoiceError('ANY', 'ad hoc', {});`, NAMED),
      errors: [{ messageId: 'constructedRefusal', data: { name: 'InvoiceError', context: 'billing' } }],
    },
  ],
});

ruleTester.run('errors-constructor-not-public under named', errorsConstructorNotPublic, {
  valid: [
    at(REFUSAL, refusal(named('forInvoice')), NAMED),
    at(REFUSAL, refusal('protected constructor(message: string) { super(message); }'), NAMED),
    at(REFUSAL, refusal('private constructor(message: string) { super(message); }'), NAMED),
    at(REFUSAL, 'export abstract class BillingRefusal extends DomainRefusal { constructor() { super(); } }', NAMED),
    at(AGGREGATE, refusal('constructor(message: string) { super(message); }'), NAMED),
  ],
  invalid: [
    {
      ...at(REFUSAL, refusal('constructor(message: string) { super(message); }'), NAMED),
      errors: [{ messageId: 'publicRefusalConstructor', data: { className: 'InvoiceAlreadyIssued' } }],
    },
    {
      ...at(REFUSAL, "export class InvoiceAlreadyIssued extends DomainError { readonly code = 'X'; }", NAMED),
      errors: [{ messageId: 'inheritedPublicRefusal', data: { className: 'InvoiceAlreadyIssued' } }],
    },
  ],
});

ruleTester.run('errors-factory-name under named', errorsFactoryName, {
  valid: [
    ...['forInvoice', 'withNotice', 'becauseOf', 'onDate', 'atStart'].map((name) =>
      at(REFUSAL, refusal(named(name)), NAMED),
    ),
    at(REFUSAL, refusal(`${named('forInvoice')}\n${named('atIssue')}`), NAMED),
    at(REFUSAL, refusal('static is(error: unknown): boolean { return error instanceof InvoiceAlreadyIssued; }'), NAMED),
    at(REFUSAL, refusal('private static forInvoices() { return 1; }\nstatic later() { return 2; }'), NAMED),
    at(AGGREGATE, refusal(named('slotTaken'), 'InvoiceAlreadyIssuedError'), NAMED),
    at(SPEC, refusal(named('slotTaken'), 'InvoiceAlreadyIssuedError'), NAMED),
    at(ERROR, concept(factory('alreadyIssued', "'INVOICE_ALREADY_ISSUED'")), FACTORIES),
  ],
  invalid: [
    ...[
      ['alreadyIssued', 'forAlreadyIssued'],
      ['create', 'forCreate'],
      ['format', 'forFormat'],
      ['onboard', 'forOnboard'],
      ['at', 'forAt'],
    ].map(([name = '', expected = '']) => ({
      ...at(REFUSAL, refusal(named(name)), NAMED),
      errors: [{ messageId: 'unprefixed' as const, data: { className: 'InvoiceAlreadyIssued', name, expected } }],
    })),
    ...['forInvoice2', 'error1'].map((name) => ({
      ...at(REFUSAL, refusal(named(name)), NAMED),
      errors: [{ messageId: 'digitInName' as const, data: { className: 'InvoiceAlreadyIssued', name } }],
    })),
    {
      ...at(REFUSAL, refusal(named('forInvoice', 'InvoiceAlreadyIssuedError'), 'InvoiceAlreadyIssuedError'), NAMED),
      errors: [
        {
          messageId: 'errorSuffix',
          data: { className: 'InvoiceAlreadyIssuedError', expected: 'InvoiceAlreadyIssued' },
        },
      ],
    },
    {
      ...at(ERROR, concept(factory('alreadyIssued', "'INVOICE_ALREADY_ISSUED'")), NAMED),
      errors: [
        { messageId: 'errorSuffix', data: { className: 'InvoiceError', expected: 'Invoice' } },
        {
          messageId: 'unprefixed',
          data: { className: 'InvoiceError', name: 'alreadyIssued', expected: 'forAlreadyIssued' },
        },
      ],
    },
  ],
});
