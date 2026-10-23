import { CONFIG_FILE } from '../../config';
import { CONTEXT_DOC_HEADINGS } from '../canonical/context-doc-headings';
import { aggregate } from './aggregate';
import { config } from './config';
import { contextDoc } from './context-doc';
import { errorsRoute as route } from './errors-route';
import type { Fixture } from './fixture';
import { PATHS } from './paths';
import { project } from './project';
import { SAMPLES } from './samples';
import { source } from './source';

const { BILLING, ROUTE } = PATHS;
const NAMED = { [CONFIG_FILE]: config({ stack: { refusals: 'named' } }) };

const CODES = `${BILLING}/billing.codes.ts`;
const ALREADY_ISSUED = `${BILLING}/domain/errors/invoice-already-issued.error.ts`;
const UNKNOWN_INVOICE = `${BILLING}/domain/errors/unknown-invoice.error.ts`;
const ALREADY_SENT = `${BILLING}/domain/errors/invoice-already-sent.error.ts`;
const LEDGER_CLOSED = `${BILLING}/domain/errors/ledger-closed.error.ts`;
const INVOICE_ERROR = `${BILLING}/domain/errors/invoice.error.ts`;

/** `billing.codes.ts`, the code list of billing, `entries` written as they are. */
const codes = (entries: string, asConst = ' as const'): string =>
  source(
    `export const BillingCodes = {`,
    entries,
    `}${asConst};`,
    '',
    'export type BillingCode = (typeof BillingCodes)[keyof typeof BillingCodes];',
  );

/** A refusal class of billing: its code as `code` writes it (none when empty), and a factory that gives `refusal(..)` its message. */
const refusal = (name: string, code = `BillingCodes.${name}`): string =>
  source(
    "import { DomainRefusal } from '@ddd-ts-kit/kernel';",
    "import { BillingCodes } from '@/contexts/billing/billing.codes.js';",
    '',
    `export class ${name} extends DomainRefusal {`,
    ...(code === '' ? [] : [`  readonly code = ${code};`, '']),
    '  static forInvoice(invoiceId: string) {',
    `    return ${name}.refusal('The invoice refuses it.', { invoiceId });`,
    '  }',
    '}',
  );

const LISTED = codes("  InvoiceAlreadyIssued: 'INVOICE_ALREADY_ISSUED',\n  UnknownInvoice: 'UNKNOWN_INVOICE',");

/** Billing under `named`: its code list and one class per refusal, what `generate error` writes. */
const NAMED_REFUSALS = {
  [CODES]: LISTED,
  [ALREADY_ISSUED]: refusal('InvoiceAlreadyIssued'),
  [UNKNOWN_INVOICE]: refusal('UnknownInvoice'),
};

/** A concept class of the form before, left over by a migration, setting a code the list holds. */
const LEFTOVER = source(
  "import { ConceptError } from '@ddd-ts-kit/kernel';",
  '',
  'export class InvoiceError extends ConceptError {',
  '  static alreadyIssued(id: string) {',
  "    return InvoiceError.refusal('INVOICE_ALREADY_ISSUED', `Refused for ${id}.`, { id });",
  '  }',
  '}',
);

const NAMED_CODE_UNIQUE: readonly Fixture[] = [
  {
    ruleId: 'errors/code-unique',
    name: 'under named, two refusal classes give refusal(..) the same message: a message is no code',
    expect: 'pass',
    files: project(NAMED_REFUSALS, NAMED),
  },
  {
    ruleId: 'errors/code-unique',
    name: 'under named, two entries of the code list under one code',
    expect: { file: CODES },
    files: project(
      {
        ...NAMED_REFUSALS,
        [CODES]: codes("  InvoiceAlreadyIssued: 'INVOICE_REFUSED',\n  UnknownInvoice: 'INVOICE_REFUSED',"),
      },
      NAMED,
    ),
  },
  {
    ruleId: 'errors/code-unique',
    name: 'under named, a concept class left over sets a code the list holds',
    expect: { file: INVOICE_ERROR },
    files: project({ ...NAMED_REFUSALS, [INVOICE_ERROR]: LEFTOVER }, NAMED),
  },
];

const CODE_LISTED: readonly Fixture[] = [
  {
    ruleId: 'errors/code-listed',
    name: 'each refusal class reads its code from the list of its context, under its own name',
    expect: 'pass',
    files: project(NAMED_REFUSALS, NAMED),
  },
  {
    ruleId: 'errors/code-listed',
    name: 'a migrated project keeps its codes, in constant case, whatever the name of the class',
    expect: 'pass',
    files: project(
      {
        ...NAMED_REFUSALS,
        [CODES]: codes("  InvoiceAlreadyIssued: 'ALREADY_ISSUED',\n  UnknownInvoice: 'INVOICE_NOT_FOUND',"),
      },
      NAMED,
    ),
  },
  {
    ruleId: 'errors/code-listed',
    name: 'an abstract refusal sets no code of its own',
    expect: 'pass',
    files: project(
      {
        ...NAMED_REFUSALS,
        [`${BILLING}/domain/errors/billing-refusal.error.ts`]:
          "import { DomainRefusal } from '@ddd-ts-kit/kernel';\n\nexport abstract class BillingRefusal extends DomainRefusal {}\n",
        // Its name is a term of the glossary, as the name of every class of domain/errors/.
        [`${BILLING}/CONTEXT.md`]: contextDoc(
          'core',
          CONTEXT_DOC_HEADINGS,
          `${SAMPLES.GLOSSARY}\n| Billing refusal | What every refusal of billing has in common. |`,
        ),
      },
      NAMED,
    ),
  },
  {
    ruleId: 'errors/code-listed',
    name: 'a project that does not say how it builds its refusals is not judged',
    expect: 'pass',
    files: project({ [ALREADY_ISSUED]: refusal('InvoiceAlreadyIssued', "'INVOICE_ALREADY_ISSUED'") }),
  },
  {
    ruleId: 'errors/code-listed',
    name: 'a refusal class that writes its code as a string literal',
    expect: { file: ALREADY_ISSUED },
    files: project(
      { ...NAMED_REFUSALS, [ALREADY_ISSUED]: refusal('InvoiceAlreadyIssued', "'INVOICE_ALREADY_ISSUED'") },
      NAMED,
    ),
  },
  {
    ruleId: 'errors/code-listed',
    name: 'a refusal class that reads the code of another entry',
    expect: { file: ALREADY_ISSUED },
    files: project(
      { ...NAMED_REFUSALS, [ALREADY_ISSUED]: refusal('InvoiceAlreadyIssued', 'BillingCodes.UnknownInvoice') },
      NAMED,
    ),
  },
  {
    ruleId: 'errors/code-listed',
    name: 'a refusal class without a code',
    expect: { file: ALREADY_ISSUED },
    files: project({ ...NAMED_REFUSALS, [ALREADY_ISSUED]: refusal('InvoiceAlreadyIssued', '') }, NAMED),
  },
  {
    ruleId: 'errors/code-listed',
    name: 'a refusal class whose name the list does not hold',
    expect: { file: ALREADY_SENT },
    files: project({ ...NAMED_REFUSALS, [ALREADY_SENT]: refusal('InvoiceAlreadySent') }, NAMED),
  },
  {
    ruleId: 'errors/code-listed',
    name: 'refusal classes in a context without its code list',
    expect: { file: ALREADY_ISSUED },
    files: project(
      { [ALREADY_ISSUED]: refusal('InvoiceAlreadyIssued'), [UNKNOWN_INVOICE]: refusal('UnknownInvoice') },
      NAMED,
    ),
  },
  {
    ruleId: 'errors/code-listed',
    name: 'an entry of the list that names no refusal class',
    expect: { file: CODES },
    files: project({ [CODES]: LISTED, [ALREADY_ISSUED]: refusal('InvoiceAlreadyIssued') }, NAMED),
  },
  {
    ruleId: 'errors/code-listed',
    name: 'a code of the list not in constant case',
    expect: { file: CODES },
    files: project(
      {
        ...NAMED_REFUSALS,
        [CODES]: codes("  InvoiceAlreadyIssued: 'invoice-already-issued',\n  UnknownInvoice: 'UNKNOWN_INVOICE',"),
      },
      NAMED,
    ),
  },
  {
    ruleId: 'errors/code-listed',
    name: 'a code of the list that is not a string literal',
    expect: { file: CODES },
    files: project(
      {
        ...NAMED_REFUSALS,
        [CODES]: codes("  InvoiceAlreadyIssued: 'INVOICE_' + 'ALREADY_ISSUED',\n  UnknownInvoice: 'UNKNOWN_INVOICE',"),
      },
      NAMED,
    ),
  },
  {
    ruleId: 'errors/code-listed',
    name: 'a codes.ts that declares no list named after its context',
    expect: { file: CODES },
    files: project({ ...NAMED_REFUSALS, [CODES]: LISTED.replaceAll('BillingCodes', 'InvoiceCodes') }, NAMED),
  },
  {
    ruleId: 'errors/code-listed',
    name: 'a code list not declared as const',
    expect: { file: CODES },
    files: project(
      {
        ...NAMED_REFUSALS,
        [CODES]: codes("  InvoiceAlreadyIssued: 'INVOICE_ALREADY_ISSUED',\n  UnknownInvoice: 'UNKNOWN_INVOICE',", ''),
      },
      NAMED,
    ),
  },
];

const NAMED_KNOWN_CODE: readonly Fixture[] = [
  {
    ruleId: 'errors/known-code',
    name: 'under named, a route declaring codes the list of its context holds',
    expect: 'pass',
    files: project(
      { ...NAMED_REFUSALS, [ROUTE]: route('FORBIDDEN', 'INVOICE_ALREADY_ISSUED', 'UNKNOWN_INVOICE') },
      NAMED,
    ),
  },
  {
    ruleId: 'errors/known-code',
    name: 'under named, a route declaring a code the list of its context does not hold',
    expect: { file: ROUTE },
    files: project({ ...NAMED_REFUSALS, [ROUTE]: route('INVOICE_ALREADY_ISSUED', 'INVOICE_VOIDED') }, NAMED),
  },
];

const NAMED_LANGUAGE: readonly Fixture[] = [
  {
    ruleId: 'language/glossary-term',
    name: 'under named, refusal classes named with terms of the glossary and the qualifiers of a refusal, the code list not judged',
    expect: 'pass',
    files: project(
      {
        ...NAMED_REFUSALS,
        [CODES]: codes(
          "  InvoiceAlreadyIssued: 'INVOICE_ALREADY_ISSUED',\n  UnknownInvoice: 'UNKNOWN_INVOICE',\n  NoMoneyRequired: 'NO_MONEY_REQUIRED',",
        ),
        [`${BILLING}/domain/errors/no-money-required.error.ts`]: refusal('NoMoneyRequired'),
      },
      NAMED,
    ),
  },
  {
    ruleId: 'language/glossary-term',
    name: 'under named, a refusal class named with a word the glossary does not define',
    expect: { file: LEDGER_CLOSED },
    files: project(
      { [CODES]: codes("  LedgerClosed: 'LEDGER_CLOSED',"), [LEDGER_CLOSED]: refusal('LedgerClosed') },
      NAMED,
    ),
  },
  {
    ruleId: 'language/glossary-term',
    name: 'a qualifier of a refusal names no concept: a domain class other than a refusal is not allowed it',
    expect: { file: PATHS.AGGREGATE },
    also: ['clean/one-export-per-file'],
    files: project(aggregate('export class UnknownInvoice {}\n'), NAMED),
  },
  {
    ruleId: 'naming/suffix',
    name: 'the code list of a context, billing.codes.ts at its root',
    expect: 'pass',
    files: project(NAMED_REFUSALS, NAMED),
  },
];

/** Under `"stack.refusals": "named"`: one class per refusal, its code read from the code list of its context. */
export const NAMED_REFUSAL_FIXTURES: readonly Fixture[] = [
  ...NAMED_CODE_UNIQUE,
  ...CODE_LISTED,
  ...NAMED_KNOWN_CODE,
  ...NAMED_LANGUAGE,
];
