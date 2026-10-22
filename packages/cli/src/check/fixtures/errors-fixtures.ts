import { CONFIG_FILE } from '../../config';
import { config } from './config';
import { errorsRoute as route } from './errors-route';
import type { Fixture } from './fixture';
import { PATHS } from './paths';
import { project } from './project';
import { source } from './source';

const { BILLING, ROUTE } = PATHS;
const CONTROLLER = `${BILLING}/presentation/http/invoices/issue-invoice/issue-invoice.controller.ts`;

const INVOICE_ERROR = `${BILLING}/domain/errors/invoice.error.ts`;
const REMINDER_ERROR = `${BILLING}/domain/errors/reminder.error.ts`;
const LEGACY_ERROR = `${BILLING}/domain/errors/issue.error.ts`;
const LEDGER_ERROR = `${BILLING}/domain/errors/ledger.error.ts`;

const FACTORIES = { [CONFIG_FILE]: config({ stack: { refusals: 'factories' } }) };

const concept = (name: string, ...factories: string[]): string =>
  source(
    "import { ConceptError } from '@ddd-ts-kit/kernel';",
    '',
    `export class ${name}Error extends ConceptError {`,
    factories.join('\n\n'),
    '}',
  );

const factory = (owner: string, name: string, code: string): string =>
  source(
    `  static ${name}(id: string) {`,
    `    return ${owner}Error.refusal('${code}', \`Refused for \${id}.\`, { id });`,
    '  }',
  ).trimEnd();

const LEGACY = source(
  "import { DomainError } from '@ddd-ts-kit/kernel';",
  '',
  'export class IssueError extends DomainError {',
  "  readonly code = 'INVOICE_ALREADY_ISSUED';",
  '}',
);

const INVOICE = concept(
  'Invoice',
  factory('Invoice', 'alreadyIssued', 'INVOICE_ALREADY_ISSUED'),
  factory('Invoice', 'notFound', 'INVOICE_NOT_FOUND'),
);

const CODE_UNIQUE: readonly Fixture[] = [
  {
    ruleId: 'errors/code-unique',
    name: 'each refusal of a context has its own code, over two concept classes',
    expect: 'pass',
    files: project(
      {
        [INVOICE_ERROR]: INVOICE,
        [REMINDER_ERROR]: concept('Reminder', factory('Reminder', 'notDue', 'REMINDER_NOT_DUE')),
      },
      FACTORIES,
    ),
  },
  {
    ruleId: 'errors/code-unique',
    name: 'the same code in two contexts: each context owns its language',
    expect: 'pass',
    files: project(
      {
        [INVOICE_ERROR]: INVOICE,
        [`${PATHS.CATALOG}/domain/errors/invoice.error.ts`]: concept(
          'Invoice',
          factory('Invoice', 'notFound', 'INVOICE_NOT_FOUND'),
        ),
      },
      FACTORIES,
    ),
  },
  {
    ruleId: 'errors/code-unique',
    name: 'a project that does not say how it builds its refusals is not judged',
    expect: 'pass',
    files: project({
      [INVOICE_ERROR]: concept('Invoice', factory('Invoice', 'alreadyIssued', 'INVOICE_ALREADY_ISSUED')),
      [LEGACY_ERROR]: LEGACY,
    }),
  },
  {
    ruleId: 'errors/code-unique',
    name: 'two factories of one class set the same code',
    expect: { file: INVOICE_ERROR },
    files: project(
      {
        [INVOICE_ERROR]: concept(
          'Invoice',
          factory('Invoice', 'alreadyIssued', 'INVOICE_ALREADY_ISSUED'),
          factory('Invoice', 'issuedTwice', 'INVOICE_ALREADY_ISSUED'),
        ),
      },
      FACTORIES,
    ),
  },
  {
    ruleId: 'errors/code-unique',
    name: 'a factory sets the code of a class per error of the same context',
    expect: { file: LEGACY_ERROR },
    files: project(
      {
        [INVOICE_ERROR]: concept('Invoice', factory('Invoice', 'alreadyIssued', 'INVOICE_ALREADY_ISSUED')),
        [LEGACY_ERROR]: LEGACY,
      },
      FACTORIES,
    ),
  },
];

const KNOWN_CODE: readonly Fixture[] = [
  {
    ruleId: 'errors/known-code',
    name: 'a route declaring codes its context sets, and codes of the kit',
    expect: 'pass',
    files: project(
      {
        [INVOICE_ERROR]: INVOICE,
        [ROUTE]: route('UNAUTHORIZED', 'FORBIDDEN', 'INVOICE_ALREADY_ISSUED', 'INVOICE_NOT_FOUND'),
      },
      FACTORIES,
    ),
  },
  {
    ruleId: 'errors/known-code',
    name: 'a code set by a class per error, and one set outside the contexts',
    expect: 'pass',
    files: project(
      {
        [LEGACY_ERROR]: LEGACY,
        'src/platform/quota/quota-exceeded-error.ts': LEGACY.replaceAll('IssueError', 'QuotaExceededError').replace(
          'INVOICE_ALREADY_ISSUED',
          'QUOTA_EXCEEDED',
        ),
        [ROUTE]: route('INVOICE_ALREADY_ISSUED', 'QUOTA_EXCEEDED'),
      },
      FACTORIES,
    ),
  },
  {
    ruleId: 'errors/known-code',
    name: 'a project that does not say how it builds its refusals is not judged',
    expect: 'pass',
    files: project({ [ROUTE]: route('INVOICE_VOIDED') }),
  },
  {
    ruleId: 'errors/known-code',
    name: 'a controller declaring a code nothing sets',
    expect: { file: CONTROLLER },
    files: project(
      {
        [INVOICE_ERROR]: INVOICE,
        [CONTROLLER]:
          "import { Controller } from '@ddd-ts-kit/http';\n\n@Controller({\n  group: InvoicesRoutes,\n  method: 'POST',\n  path: '/',\n  errors: ['INVOICE_ALREADY_ISSUED', 'INVOICE_VOIDED'],\n})\nexport class IssueInvoiceController {}\n",
      },
      FACTORIES,
    ),
  },
  {
    ruleId: 'errors/known-code',
    name: 'a route declaring a code nothing sets',
    expect: { file: ROUTE },
    files: project({ [INVOICE_ERROR]: INVOICE, [ROUTE]: route('FORBIDDEN', 'INVOICE_VOIDED') }, FACTORIES),
  },
  {
    ruleId: 'errors/known-code',
    name: 'a route declaring a code only another context sets',
    expect: { file: ROUTE },
    files: project(
      {
        [`${PATHS.CATALOG}/domain/errors/reminder.error.ts`]: concept(
          'Reminder',
          factory('Reminder', 'notDue', 'REMINDER_NOT_DUE'),
        ),
        [ROUTE]: route('REMINDER_NOT_DUE'),
      },
      FACTORIES,
    ),
  },
];

const ERROR_LANGUAGE: readonly Fixture[] = [
  {
    ruleId: 'language/glossary-term',
    name: 'an error class named after a term of the glossary',
    expect: 'pass',
    files: project({ [INVOICE_ERROR]: INVOICE }, FACTORIES),
  },
  {
    ruleId: 'language/glossary-term',
    name: 'an error class named after a word the glossary does not define',
    expect: { file: LEDGER_ERROR },
    files: project({ [LEDGER_ERROR]: concept('Ledger', factory('Ledger', 'closed', 'LEDGER_CLOSED')) }, FACTORIES),
  },
  {
    ruleId: 'language/glossary-term',
    name: 'a class per error keeps its free name while the project does not build through factories',
    expect: 'pass',
    files: project({ [LEDGER_ERROR]: concept('Ledger', factory('Ledger', 'closed', 'LEDGER_CLOSED')) }),
  },
];

export const ERRORS_FIXTURES: readonly Fixture[] = [...CODE_UNIQUE, ...KNOWN_CODE, ...ERROR_LANGUAGE];
