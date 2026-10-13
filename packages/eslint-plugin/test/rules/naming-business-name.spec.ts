import { namingBusinessName } from '../../src/rules/naming-business-name.js';
import { at, BILLING, ruleTester, SAMPLE_CONFIG } from '../support/rule-tester.js';

const HANDLER = `${BILLING}/application/commands/issue-invoice/issue-invoice.handler.ts`;
const AGGREGATE = `${BILLING}/domain/aggregates/invoice.aggregate.ts`;
const SHARED = 'src/shared-kernel/period.ts';
const INVOICE = "import { Invoice } from '@/contexts/billing/domain/aggregates/invoice.aggregate';\n";

/** A use case as the handler templates write it, with the binding of the aggregate named `name`. */
const issuing = (name: string): string =>
  `${INVOICE}export class IssueInvoiceHandler {\n  async execute(): Promise<string> {\n    const ${name} = Invoice.create('invoice-1');\n\n    await this.invoiceRepository.save({ ${name} });\n\n    return ${name}.id;\n  }\n}\n`;

const generic = (kind: string, name: string, advice: string) => ({
  messageId: 'generic' as const,
  data: { kind, name, advice },
});

const CONCEPT = 'Name it after the concept it holds, a term of the glossary of the context (CONTEXT.md).';
const named = (name: string): string => `Name it \`${name}\`, the name the code already gives to what it holds.`;

ruleTester.run('naming-business-name', namingBusinessName, {
  valid: [
    at(HANDLER, issuing('invoice')),
    at(
      HANDLER,
      'export class Handler {\n  private readonly issued: string[] = [];\n\n  run({ lines }: Draft, ...notes: string[]): void {\n    const [first] = lines;\n\n    for (const line of lines) {\n      this.issued.push(line.label, first, ...notes);\n    }\n  }\n}\n',
    ),
    at(
      AGGREGATE,
      "export class Invoice {\n  toLine(): Line {\n    return { item: this.label, data: 1 };\n  }\n}\nexport interface Draft {\n  readonly address: { data: string };\n}\nenum Kind {\n  Data = 'data',\n}\n",
    ),
    at(
      `${BILLING}/infrastructure/persistence/in-memory-invoice.repository.ts`,
      'const target = 1;\nexport const items = [target];',
    ),
    at(
      `${BILLING}/presentation/http/shared/invoice.serializer.ts`,
      'export const serialize = (item: Invoice) => item.id;',
    ),
    at(`${BILLING}/test/unit/invoice.aggregate.spec.ts`, 'const target = anInvoice();'),
    at('src/platform/buses/logged.ts', 'export const logged = (info: MessageInfo) => info.name;'),
    at('src/shared-kernel/presentation/page.schema.ts', 'export const item = 1;'),
    { ...at(HANDLER, 'const data = 1;'), options: [{ allow: ['data'] }] },
    { ...at(HANDLER, 'const target = 1;'), options: [{ words: ['record'] }] },
    at(HANDLER, 'const info = 1;', { ...SAMPLE_CONFIG, businessNames: { allow: ['info'] } }),
    at(HANDLER, 'const target = 1;', { ...SAMPLE_CONFIG, businessNames: { words: [] } }),
  ],
  invalid: [
    {
      ...at(HANDLER, issuing('target')),
      errors: [generic('variable', 'target', named('invoice'))],
      output: `${INVOICE}export class IssueInvoiceHandler {\n  async execute(): Promise<string> {\n    const invoice = Invoice.create('invoice-1');\n\n    await this.invoiceRepository.save({ target: invoice });\n\n    return invoice.id;\n  }\n}\n`,
    },
    {
      ...at(
        HANDLER,
        'class Invoice {}\nexport function issue(): Invoice {\n  const data: Invoice = new Invoice();\n\n  return data;\n}\n',
      ),
      errors: [generic('variable', 'data', named('invoice'))],
      output:
        'class Invoice {}\nexport function issue(): Invoice {\n  const invoice: Invoice = new Invoice();\n\n  return invoice;\n}\n',
    },
    {
      ...at(
        HANDLER,
        'export async function cancel(this: Handler, id: string): Promise<void> {\n  const target = await this.invoiceRepository.findById(id);\n\n  target.cancel();\n}\n',
      ),
      errors: [generic('variable', 'target', named('invoice'))],
      output:
        'export async function cancel(this: Handler, id: string): Promise<void> {\n  const invoice = await this.invoiceRepository.findById(id);\n\n  invoice.cancel();\n}\n',
    },
    {
      ...at(
        HANDLER,
        'export async function remind(): Promise<void> {\n  const items = await invoiceRepository.findOverdue();\n\n  send(items);\n}\n',
      ),
      errors: [generic('variable', 'items', named('invoices'))],
      output:
        'export async function remind(): Promise<void> {\n  const invoices = await invoiceRepository.findOverdue();\n\n  send(invoices);\n}\n',
    },
    {
      ...at(HANDLER, `${INVOICE}const invoice = 1;\nconst target = Invoice.create(invoice);\nsend(target);\n`),
      errors: [generic('variable', 'target', named('invoice'))],
      output: null,
    },
    {
      ...at(HANDLER, `${INVOICE}const target = Invoice.create('1');\nlines.map((invoice) => target.add(invoice));\n`),
      errors: [generic('variable', 'target', named('invoice'))],
      output: null,
    },
    {
      ...at(HANDLER, `${INVOICE}export const target = Invoice.create('1');\n`),
      errors: [generic('variable', 'target', named('invoice'))],
      output: null,
    },
    {
      ...at(HANDLER, `${INVOICE}const items = Invoice.create('1');\nsend(items);\n`),
      errors: [generic('variable', 'items', named('invoice'))],
      output: null,
    },
    {
      ...at(
        HANDLER,
        "import { Money } from 'money-lib';\nconst data = new Map();\nconst obj = Money.create(1);\nconst temp = await this.invoiceRepository.save(x);\nconst stuff = await this.invoiceRepository.findDue();\n",
      ),
      errors: [
        generic('variable', 'data', CONCEPT),
        generic('variable', 'obj', CONCEPT),
        generic('variable', 'temp', CONCEPT),
        generic('variable', 'stuff', CONCEPT),
      ],
    },
    {
      ...at(
        HANDLER,
        'for (const target of dueReminders) {}\nfor (const item in this.deliveries) {}\nfor (const el of due) {}\n',
      ),
      errors: [
        generic('loop variable', 'target', 'Name it after one element of the collection, in the singular: `reminder`.'),
        generic('loop variable', 'item', 'Name it after one element of the collection, in the singular: `delivery`.'),
        generic(
          'loop variable',
          'el',
          'Name it after one element of the collection, in the singular (`for (const reminder of dueReminders)`).',
        ),
      ],
    },
    {
      ...at(
        HANDLER,
        'const { invoiceId, lines: data } = command;\nconst [first, ...things] = lines;\nfor (const [key, item] of entries) {}\n',
      ),
      errors: [
        generic('destructured binding', 'data', CONCEPT),
        generic('destructured binding', 'things', CONCEPT),
        generic('destructured binding', 'item', CONCEPT),
      ],
    },
    {
      ...at(
        AGGREGATE,
        'export class Invoice {\n  private readonly info = 1;\n\n  constructor(private readonly data: string) {}\n\n  add(element: Line, { item }: Draft, tmp = 1, ...foo: string[]): void {}\n}\nexport abstract class InvoicePort {\n  abstract readonly bar: string;\n\n  abstract charge(target: string): void;\n}\nexport const each = (baz: Line): void => undefined;\nexport function apply(object: Line): void {}\n',
      ),
      errors: [
        generic('property', 'info', CONCEPT),
        generic('property', 'data', CONCEPT),
        generic('parameter', 'element', CONCEPT),
        generic('destructured binding', 'item', CONCEPT),
        generic('parameter', 'tmp', CONCEPT),
        generic('parameter', 'foo', CONCEPT),
        generic('property', 'bar', CONCEPT),
        generic('parameter', 'target', CONCEPT),
        generic('parameter', 'baz', CONCEPT),
        generic('parameter', 'object', CONCEPT),
      ],
    },
    {
      ...at(
        SHARED,
        'export interface Period {\n  readonly things: string[];\n  overlaps(target: Period): boolean;\n}\nexport type Draft = {\n  readonly stuff: string;\n};\nexport type OnLine = (item: Line) => void;\n',
      ),
      errors: [
        generic('property', 'things', CONCEPT),
        generic('parameter', 'target', CONCEPT),
        generic('property', 'stuff', CONCEPT),
        generic('parameter', 'item', CONCEPT),
      ],
    },
    {
      ...at(HANDLER, 'const record = 1;\nconst data = 2;'),
      options: [{ words: ['record'] }],
      errors: [generic('variable', 'record', CONCEPT)],
    },
    {
      ...at(HANDLER, 'const record = 1;\nconst data = 2;', {
        ...SAMPLE_CONFIG,
        businessNames: { words: ['record', 'data'] },
      }),
      options: [{ allow: ['data'] }],
      errors: [generic('variable', 'record', CONCEPT)],
    },
  ],
});
