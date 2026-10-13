import { domainValueObjectClass } from '../../src/rules/domain-value-object-class.js';
import { at, BILLING, ruleTester } from '../support/rule-tester.js';

const MONEY = `${BILLING}/domain/value-objects/money.vo.ts`;
const INVOICE_MONEY = `${BILLING}/domain/value-objects/invoice-money.vo.ts`;
const SERVICE = `${BILLING}/domain/services/invoice-total.service.ts`;
const MACHINE = `${BILLING}/domain/state-machines/invoice.state-machine.ts`;
const HANDLER = `${BILLING}/application/commands/issue-invoice/issue-invoice.handler.ts`;
const SPEC = `${BILLING}/test/unit/money.vo.spec.ts`;
const SHARED = 'src/shared-kernel/money.vo.ts';
const SHARED_SCHEMA = 'src/shared-kernel/presentation/money.vo.ts';

const PROPS = 'export type MoneyProps = { readonly cents: number };';
const KERNEL = "import { ValueObject } from '@ddd-ts-kit/kernel';";

const VALUE_OBJECT = `${KERNEL}
${PROPS}
export class Money extends ValueObject<MoneyProps> {
  private constructor(props: MoneyProps) { super(props); }
  static of(cents: number): Money { return new Money({ cents }); }
  add(other: Money): Money { return Money.of(this.props.cents + other.props.cents); }
}`;

const PLAIN = 'export const money = (cents: number, currency: string) => ({ cents, currency });';

ruleTester.run('domain-value-object-class', domainValueObjectClass, {
  valid: [
    at(MONEY, VALUE_OBJECT),
    at(SHARED, VALUE_OBJECT),
    at(
      MONEY,
      `${KERNEL}\nexport interface MoneyProps { readonly cents: number }\nexport class Money extends ValueObject<MoneyProps> { static zero(): Money { return new Money({ cents: 0 }); } }`,
    ),
    at(
      MONEY,
      `${KERNEL}\nexport abstract class Money extends ValueObject<{ readonly cents: number }> { protected constructor(props: { readonly cents: number }) { super(props); } }`,
    ),
    at(
      INVOICE_MONEY,
      "import { Money } from '@/contexts/billing/domain/value-objects/money.vo';\nexport class InvoiceMoney extends Money { static due(cents: number): InvoiceMoney { return new InvoiceMoney({ cents }); } }",
    ),
    at(
      MONEY,
      `${KERNEL}\nclass Quantity extends ValueObject<{ readonly n: number }> {}\nexport class Money extends Quantity { static of(n: number): Money { return new Money({ n }); } }`,
    ),
    at(
      SERVICE,
      'export function invoiceTotal(lines: readonly Money[]): Money { const rows = lines.map((line) => { return { line }; }); return rows.reduce((sum, { line }) => sum.add(line), Money.of(0)); }',
    ),
    at(SERVICE, 'export const isDue = (invoice: Invoice, now: Date): boolean => invoice.dueAt <= now;'),
    at(
      SERVICE,
      'export const dueOn = (day: Date) => ({ isSatisfiedBy: (invoice: Invoice): boolean => invoice.dueAt <= day, describe() { return String(day); } });',
    ),
    at(SERVICE, 'export class InvoiceTotalService { total(): { cents: number } { return { cents: 0 }; } }'),
    at(
      MACHINE,
      "export const invoiceLifecycle = defineStateMachine({ states: ['draft'], initial: ['draft'], transitions: {}, refused: () => ({ code: 'X' }) });",
    ),
    at(HANDLER, PLAIN),
    at(SPEC, PLAIN),
    at(SHARED_SCHEMA, PLAIN),
    at('src/shared-kernel/storable-stamp.ts', PLAIN),
  ],
  invalid: [
    {
      ...at(MONEY, `${PROPS}\n${PLAIN}`),
      errors: [{ messageId: 'noClass' }, { messageId: 'exportedFunction', data: { name: 'money' } }],
    },
    {
      ...at(
        MONEY,
        'export class Money { private constructor(readonly cents: number) {} static of(cents: number): Money { return new Money(cents); } }',
      ),
      errors: [{ messageId: 'notValueObject', data: { className: 'Money' } }],
    },
    {
      ...at(
        MONEY,
        `${KERNEL}\nexport class Money extends ValueObject<MoneyProps> { constructor(props: MoneyProps) { super(props); } static of(cents: number): Money { return new Money({ cents }); } }`,
      ),
      errors: [{ messageId: 'publicConstructor', data: { className: 'Money' } }],
    },
    {
      ...at(
        MONEY,
        `${KERNEL}\nexport class Money extends ValueObject<MoneyProps> { private constructor(props: MoneyProps) { super(props); } }`,
      ),
      errors: [{ messageId: 'noFactory', data: { className: 'Money' } }],
    },
    {
      ...at(
        MONEY,
        `${VALUE_OBJECT}\nexport function zero(): Money { return Money.of(0); }\nexport const ZERO = { cents: 0 } as const;`,
      ),
      errors: [
        { messageId: 'exportedFunction', data: { name: 'zero' } },
        { messageId: 'exportedLiteral', data: { name: 'ZERO' } },
      ],
    },
    {
      ...at(
        MONEY,
        `${VALUE_OBJECT}\nexport class Cents extends ValueObject<MoneyProps> { static of(): Cents { return new Cents({ cents: 0 }); } }`,
      ),
      errors: [{ messageId: 'secondClass', data: { className: 'Cents' } }],
    },
    {
      ...at(SHARED, PLAIN),
      errors: [{ messageId: 'noClass' }, { messageId: 'exportedFunction' }],
    },
    {
      ...at(
        SERVICE,
        'export function money(cents: number, currency: string) { const rounded = Math.round(cents); return { cents: rounded, currency }; }',
      ),
      errors: [{ messageId: 'plainValue', data: { name: 'money' } }],
    },
    {
      ...at(SERVICE, PLAIN),
      errors: [{ messageId: 'plainValue', data: { name: 'money' } }],
    },
    {
      ...at(SERVICE, 'export const money = function (cents: number) { return { ...base, cents } satisfies Money; };'),
      errors: [{ messageId: 'plainValue', data: { name: 'money' } }],
    },
  ],
});
