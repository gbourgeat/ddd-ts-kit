import { declarationsConstructorInjection } from '../../src/rules/declarations-constructor-injection';
import { DECLARED, EXPLICIT, HANDLER, JOB, REPOSITORY, SPEC, declaring } from '../support/declared-style';
import { at, BILLING, ruleTester, SAMPLE_CONFIG } from '../support/rule-tester';

const SIGNATURE = { ...SAMPLE_CONFIG, stack: { style: 'declared', assembly: 'barrel', dependencies: 'signature' } };
const MAPPER = `${BILLING}/infrastructure/persistence/invoice.mapper.ts`;

const handler = (decorator: string, parameters: string): string =>
  declaring('CommandHandler', `${decorator}\nexport class IssueInvoiceHandler {\n  constructor(${parameters}) {}\n}`);

const BARE = '@CommandHandler(IssueInvoiceCommand)';
const LISTED = '@CommandHandler(IssueInvoiceCommand, [InvoiceRepository, Clock])';
const TAKEN = 'private readonly invoices: InvoiceRepository, private readonly clock: Clock';

ruleTester.run('declarations-constructor-injection', declarationsConstructorInjection, {
  valid: [
    at(HANDLER, handler(BARE, TAKEN), SIGNATURE),
    at(HANDLER, handler(BARE, TAKEN), DECLARED),
    at(
      HANDLER,
      handler(BARE, 'readonly cache: Cache<Session>, @Optional() protected readonly clock: Clock'),
      SIGNATURE,
    ),
    at(HANDLER, declaring('CommandHandler', `${BARE}\nexport class IssueInvoiceHandler {}`), SIGNATURE),
    // A project that lists its dependencies in its decorators keeps doing so: the list is never reported.
    at(HANDLER, handler(LISTED, TAKEN), DECLARED),
    at(HANDLER, handler(LISTED, 'private readonly invoices: Invoices, private readonly retries = 3'), DECLARED),
    // An inherited constructor is read by `ddd-ts-kit check`, which sees the base class; here the list is its only statement.
    at(
      REPOSITORY,
      declaring(
        'Repository',
        '@Repository(InvoiceRepository, [KnexContext])\nexport class KnexInvoices extends KnexStore {}',
      ),
      SIGNATURE,
    ),
    at(
      REPOSITORY,
      declaring('Repository', '@Repository(InvoiceRepository)\nexport class KnexInvoices extends KnexStore {}'),
      SIGNATURE,
    ),
    // A message is built by its sender and is injected nothing.
    at(
      `${BILLING}/application/commands/issue-invoice/issue-invoice.command.ts`,
      declaring(
        'Public',
        '@Public()\nexport class IssueInvoiceCommand {\n  constructor(readonly amount: number, readonly note?: string) {}\n}',
      ),
      SIGNATURE,
    ),
    at(HANDLER, handler(BARE, 'private readonly retries = 3'), EXPLICIT),
    at(SPEC, handler(BARE, 'private readonly retries = 3'), SIGNATURE),
    at(MAPPER, handler(BARE, 'private readonly retries = 3'), SIGNATURE),
    at(HANDLER, 'export class IssueInvoiceHandler {\n  constructor(private readonly retries = 3) {}\n}', SIGNATURE),
  ],
  invalid: [
    {
      ...at(
        HANDLER,
        handler(BARE, 'a: InvoiceRepository | undefined, b?: Clock, c: Clock = fixed, ...d: Clock[]'),
        SIGNATURE,
      ),
      errors: [
        {
          messageId: 'parameter',
          data: {
            name: 'a',
            className: 'IssueInvoiceHandler',
            flaw: 'is typed by something that names no single class',
          },
        },
        {
          messageId: 'parameter',
          data: {
            name: 'b',
            className: 'IssueInvoiceHandler',
            flaw: 'is optional: the composition root gives every parameter a value, always',
          },
        },
        {
          messageId: 'parameter',
          data: {
            name: 'c',
            className: 'IssueInvoiceHandler',
            flaw: 'has a default value: the composition root gives every parameter a value, always',
          },
        },
        {
          messageId: 'parameter',
          data: {
            name: 'd',
            className: 'IssueInvoiceHandler',
            flaw: 'is a rest parameter: the composition root gives every parameter a value, always',
          },
        },
      ],
    },
    {
      ...at(
        JOB,
        declaring(
          'Scheduled',
          "interface Settings {}\ntype Limit = number;\n@Scheduled('billing.send-reminders', { every: '1h' })\nexport class SendRemindersJob {\n  constructor(a: Settings, b: Limit, c: string, d: Date, e, { f }: Clock, g: kernel.Clock) {}\n}",
        ),
        DECLARED,
      ),
      errors: [
        {
          messageId: 'parameter',
          data: {
            name: 'a',
            className: 'SendRemindersJob',
            flaw: 'is typed `Settings`, an interface: only a class exists at run time and can be an injection token',
          },
        },
        {
          messageId: 'parameter',
          data: {
            name: 'b',
            className: 'SendRemindersJob',
            flaw: 'is typed `Limit`, a type alias: only a class exists at run time and can be an injection token',
          },
        },
        {
          messageId: 'parameter',
          data: { name: 'c', className: 'SendRemindersJob', flaw: 'is typed by something that names no single class' },
        },
        {
          messageId: 'parameter',
          data: {
            name: 'd',
            className: 'SendRemindersJob',
            flaw: 'is typed `Date`, a type of the language: it names nothing the composition root binds',
          },
        },
        { messageId: 'parameter', data: { name: 'e', className: 'SendRemindersJob', flaw: 'has no type' } },
        {
          messageId: 'parameter',
          data: {
            name: 'the destructured one',
            className: 'SendRemindersJob',
            flaw: 'is destructured: the composition root gives every parameter a value, always',
          },
        },
        {
          messageId: 'parameter',
          data: { name: 'g', className: 'SendRemindersJob', flaw: 'is typed by something that names no single class' },
        },
      ],
    },
    {
      ...at(HANDLER, handler(LISTED, TAKEN), SIGNATURE),
      output: handler(BARE, TAKEN),
      errors: [
        { messageId: 'redundant', data: { className: 'IssueInvoiceHandler', listed: 'InvoiceRepository, Clock' } },
      ],
    },
    {
      ...at(
        REPOSITORY,
        declaring(
          'Repository',
          '@Repository(\n  InvoiceRepository,\n  { transient: true },\n  [\n    KnexContext,\n  ],\n)\nexport class KnexInvoices {\n  constructor(private readonly database: KnexContext) {}\n}',
        ),
        SIGNATURE,
      ),
      output: declaring(
        'Repository',
        '@Repository(\n  InvoiceRepository,\n  { transient: true },\n)\nexport class KnexInvoices {\n  constructor(private readonly database: KnexContext) {}\n}',
      ),
      errors: [{ messageId: 'redundant' }],
    },
    {
      ...at(
        HANDLER,
        handler('@CommandHandler(IssueInvoiceCommand, [InvoiceRepository, IdGenerator])', TAKEN),
        SIGNATURE,
      ),
      errors: [
        { messageId: 'differs', data: { className: 'IssueInvoiceHandler', listed: 'InvoiceRepository, IdGenerator' } },
      ],
    },
    {
      ...at(HANDLER, declaring('CommandHandler', `${LISTED}\nexport class IssueInvoiceHandler {}`), SIGNATURE),
      errors: [{ messageId: 'differs' }],
    },
    {
      ...at(
        HANDLER,
        handler('@CommandHandler(IssueInvoiceCommand, [Invoices, SETTINGS()])', 'a: Invoices, b: Settings'),
        SIGNATURE,
      ),
      errors: [{ messageId: 'differs', data: { className: 'IssueInvoiceHandler', listed: 'Invoices, ?' } }],
    },
  ],
});
