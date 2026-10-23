import { cleanFunctionSize } from '../../src/rules/clean-function-size';
import { cleanNoEscapeHatch } from '../../src/rules/clean-no-escape-hatch';
import { cleanNoFlagArgument } from '../../src/rules/clean-no-flag-argument';
import { at, BILLING, ruleTester, SAMPLE_CONFIG } from '../support/rule-tester';

const AGGREGATE = `${BILLING}/domain/aggregates/invoice.aggregate.ts`;
const HANDLER = `${BILLING}/application/commands/issue-invoice/issue-invoice.handler.ts`;
const body = (lines: number): string => Array.from({ length: lines }, (_, index) => `  step${index}();`).join('\n');

ruleTester.run('clean-function-size', cleanFunctionSize, {
  valid: [
    'function charge(amount: Amount, card: Card, at: Date): void {}',
    'function issue(lines: Lines, customer: Customer, actor: Actor, now: Date): void {}',
    'class Invoice { reschedule(slot: Slot, reason: Reason, by: Actor, at: Date): void {} }',
    'class Handler { constructor(a: A, b: B, c: C, d: D, e: E) {} }',
    'function bound(this: Window, a: A, b: B, c: C): void {}',
    `function steps(): void {\n${body(30)}\n}`,
    `function documented(): void {\n${body(29)}\n\n  // why this order matters\n\n  /* a block\n     on two lines */\n  last();\n}`,
    { code: 'function wide(a: A, b: B, c: C, d: D): void {}', options: [{ maxParameters: 4 }] },
    at('src/a.ts', 'function wide(a: A, b: B, c: C, d: D): void {}', { limits: { maxParameters: 4 } }),
    at(`${BILLING}/billing.module.ts`, `export function register(): void {\n${body(40)}\n}`),
    `describe('an invoice', () => {\n${body(40)}\n});`,
    `describe.each([1, 2])('an invoice %s', () => {\n${body(40)}\n});`,
    `describe.skip('an invoice', () => {\n${body(40)}\n});`,
    `context('an issued invoice', () => {\n${body(40)}\n});`,
    `runner.describe('a repository', () => {\n${body(40)}\n});`,
  ],
  invalid: [
    {
      code: 'function charge(amount: Amount, card: Card, retry: number, note: string, at: Date): void {}',
      errors: [{ messageId: 'parameters', data: { name: "Function 'charge'", count: 4, limit: 3 } }],
    },
    {
      code: 'function charge(amount: Amount, card: Card, retry: number, at?: Date): void {}',
      errors: [{ messageId: 'parameters', data: { name: "Function 'charge'", count: 4, limit: 3 } }],
    },
    {
      code: 'const charge = (a: A, b: B, c: C, d: D): void => {};',
      errors: [{ messageId: 'parameters', data: { name: "Arrow function 'charge'", count: 4, limit: 3 } }],
    },
    {
      code: 'class Gateway { charge(a: A, b: B, c: C, d: D): void {} }',
      errors: [{ messageId: 'parameters', data: { name: "Method 'charge'", count: 4, limit: 3 } }],
    },
    {
      code: `function steps(): void {\n${body(31)}\n}`,
      errors: [{ messageId: 'lines', data: { name: "Function 'steps'", count: 31, limit: 30 } }],
    },
    { code: `const steps = () => {\n${body(31)}\n};`, errors: [{ messageId: 'lines' }] },
    {
      code: `function steps(): void {\n${body(11)}\n}`,
      options: [{ maxLines: 10 }],
      errors: [{ messageId: 'lines', data: { name: "Function 'steps'", count: 11, limit: 10 } }],
    },
    {
      ...at('src/a.ts', `function steps(): void {\n${body(6)}\n}`, { limits: { maxFunctionLines: 5 } }),
      errors: [{ messageId: 'lines' }],
    },
    { code: `it('issues', () => {\n${body(31)}\n});`, errors: [{ messageId: 'lines' }] },
    { code: `context.run(scope, () => {\n${body(31)}\n});`, errors: [{ messageId: 'lines' }] },
  ],
});

ruleTester.run('clean-no-flag-argument', cleanNoFlagArgument, {
  valid: [
    at(AGGREGATE, 'class Invoice { issue(at: Date): void {} cancel(reason: string): void {} }'),
    at(AGGREGATE, 'class Invoice { private mark(paid: boolean): void {} #flag(on = true): void {} }'),
    at(AGGREGATE, 'class Invoice { private constructor(private readonly paid: boolean) {} }'),
    at(
      `${BILLING}/application/commands/issue-invoice/issue-invoice.command.ts`,
      'class IssueInvoiceCommand { with(draft: boolean): this { return this; } }',
    ),
    at(
      HANDLER,
      'class IssueInvoiceHandler { async execute(command: IssueInvoiceCommand): Promise<void> {} helper(flag: boolean): void {} }',
    ),
    at(
      `${BILLING}/infrastructure/persistence/invoice.mapper.ts`,
      'class InvoiceMapper { toRow(invoice: Invoice, partial: boolean): Row { return {}; } }',
    ),
    at(
      `${BILLING}/test/builders/invoice.builder.ts`,
      'class InvoiceBuilder { paid(value: boolean): this { return this; } }',
    ),
    'class Anything { run(dry: boolean): void {} }',
  ],
  invalid: [
    {
      ...at(AGGREGATE, 'class Invoice { close(force: boolean): void {} }'),
      errors: [{ messageId: 'flag', data: { className: 'Invoice', method: 'close', flag: 'force' } }],
    },
    {
      ...at(AGGREGATE, 'class Invoice { close(reason: string, notify = true): void {} }'),
      errors: [{ messageId: 'flag', data: { className: 'Invoice', method: 'close', flag: 'notify' } }],
    },
    {
      ...at(AGGREGATE, 'class Invoice { close(notify?: boolean | undefined): void {} }'),
      errors: [{ messageId: 'flag' }],
    },
    {
      ...at(
        AGGREGATE,
        'class Invoice { static create(id: string, draft: boolean): Invoice { return new Invoice(); } }',
      ),
      errors: [{ messageId: 'flag' }],
    },
    { ...at(AGGREGATE, 'class Invoice { close = (force: boolean): void => {}; }'), errors: [{ messageId: 'flag' }] },
    {
      ...at(
        HANDLER,
        'class IssueInvoiceHandler { async execute(command: IssueInvoiceCommand, dryRun: boolean): Promise<void> {} }',
      ),
      errors: [{ messageId: 'flag', data: { className: 'IssueInvoiceHandler', method: 'execute', flag: 'dryRun' } }],
    },
  ],
});

ruleTester.run('clean-no-escape-hatch', cleanNoEscapeHatch, {
  valid: [
    "const roles = ['admin', 'agent'] as const;",
    'const config = { port: 3000 } satisfies Config;',
    'const loose = value as unknown;',
    at(`${BILLING}/infrastructure/persistence/invoice.mapper.ts`, 'const state = row.state as InvoiceState;'),
    at(`${BILLING}/infrastructure/external/stripe.gateway.ts`, 'const body = (await response.json()) as StripeCharge;'),
    at('src/shared-kernel/money.mapper.ts', 'const amount = raw as Money;'),
    { code: 'const invoice = raw as Invoice;', options: [{ typeAssertions: false }] },
    '// eslint-disable-next-line no-console -- the CLI prints its result\nconsole.log(result);',
    '/* eslint-disable no-console -- this file is the logger */',
    '// eslint-enable no-console',
    'function isInvoice(value: unknown): value is Invoice { return true; }',
    {
      ...at('packages/drizzle/src/postgres/outbox.ts', 'const record = row as OutboxRecord;', {}),
      options: [{ adapterGlobs: ['packages/*/src/postgres/**'] }],
    },
    {
      ...at('src/platform/database/rows.ts', 'const record = row as OutboxRecord;'),
      options: [{ adapterGlobs: ['src/platform/database/*.ts', 'src/platform/http/**'] }],
    },
    {
      code: 'class Client { async get<Body>(path: string): Promise<Body> { const value: unknown = await this.read(path); return value as Body; } }',
      options: [{ allowCallerClaimedGenerics: true }],
    },
    {
      code: 'function parse<T>(text: string): T | undefined { return text === "" ? undefined : (JSON.parse(text) as T); }',
      options: [{ allowCallerClaimedGenerics: true }],
    },
    {
      code: 'const first = <Row>(rows: unknown[]): Row => rows[0] as unknown as Row;',
      options: [{ allowCallerClaimedGenerics: true }],
    },
    {
      code: 'function all<Row>(rows: unknown[]): Row[] { return rows.map((row) => row as Row); }',
      options: [{ allowCallerClaimedGenerics: true }],
    },
  ],
  invalid: [
    { code: 'const invoice = raw as Invoice;', errors: [{ messageId: 'assertion', data: { type: 'Invoice' } }] },
    {
      code: 'const invoice = raw as unknown as Invoice;',
      errors: [{ messageId: 'assertion', data: { type: 'Invoice' } }],
    },
    { code: 'const invoice = <Invoice>raw;', errors: [{ messageId: 'assertion' }] },
    {
      code: 'const empty = {} as Record<string, number>;',
      errors: [{ messageId: 'assertion', data: { type: 'Record<string, number>' } }],
    },
    {
      ...at(
        `${BILLING}/domain/aggregates/invoice.aggregate.ts`,
        'const state = snapshot as InvoiceState;',
        SAMPLE_CONFIG,
      ),
      errors: [{ messageId: 'assertion' }],
    },
    {
      code: '// eslint-disable-next-line no-console\nconsole.log(result);',
      errors: [{ messageId: 'undescribedDisable', data: { directive: 'eslint-disable-next-line' } }],
    },
    {
      code: '/* eslint-disable no-console */',
      errors: [{ messageId: 'undescribedDisable', data: { directive: 'eslint-disable' } }],
    },
    { code: 'console.log(result); // eslint-disable-line no-console', errors: [{ messageId: 'undescribedDisable' }] },
    {
      ...at('src/platform/http/server.ts', 'const record = row as OutboxRecord;'),
      options: [{ adapterGlobs: ['src/platform/database/*.ts'] }],
      errors: [{ messageId: 'assertion' }],
    },
    {
      ...at('src/platform/database/nested/rows.ts', 'const record = row as OutboxRecord;'),
      options: [{ adapterGlobs: ['src/platform/database/*.ts'] }],
      errors: [{ messageId: 'assertion' }],
    },
    {
      code: 'class Client { async get<Body>(path: string): Promise<Body> { return (await this.read(path)) as Body; } }',
      errors: [{ messageId: 'assertion', data: { type: 'Body' } }],
    },
    {
      code: 'function store<Row>(row: unknown): void { keep(row as Row); }',
      options: [{ allowCallerClaimedGenerics: true }],
      errors: [{ messageId: 'assertion' }],
    },
    {
      code: 'function load<Row>(row: unknown): Row[] { return [row as Row[]][0]; }',
      options: [{ allowCallerClaimedGenerics: true }],
      errors: [{ messageId: 'assertion', data: { type: 'Row[]' } }],
    },
    {
      code: 'function load<Row>(row: unknown): Row { return row as Invoice; }',
      options: [{ allowCallerClaimedGenerics: true }],
      errors: [{ messageId: 'assertion' }],
    },
    {
      code: 'class Box<T> { open(value: unknown): T { return value as T; } }',
      options: [{ allowCallerClaimedGenerics: true }],
      errors: [{ messageId: 'assertion' }],
    },
    {
      code: 'function outer<T>(value: unknown): T { class Inner<T> { read(): T { return value as T; } } return new Inner<T>().read(); }',
      options: [{ allowCallerClaimedGenerics: true }],
      errors: [{ messageId: 'assertion' }],
    },
  ],
});
