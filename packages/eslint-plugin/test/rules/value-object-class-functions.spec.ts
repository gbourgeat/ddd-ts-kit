import { domainValueObjectClass } from '../../src/rules/domain-value-object-class';
import { at, BILLING, ruleTester } from '../support/rule-tester';
import { classes, IMPORT_MONEY, PLAIN, SERVICE } from '../support/value-object-samples';

const MACHINE = `${BILLING}/domain/state-machines/invoice.state-machine.ts`;
const HANDLER = `${BILLING}/application/commands/issue-invoice/issue-invoice.handler.ts`;
const SPEC = `${BILLING}/test/unit/money.vo.spec.ts`;
const SHARED_PLAIN = 'src/shared-kernel/money.ts';

const service = (code: string): ReturnType<typeof classes> => classes(SERVICE, `${IMPORT_MONEY}\n${code}`);
const plainValue = (name: string) => [{ messageId: 'plainValue' as const, data: { name } }];

ruleTester.run('domain-value-object-class, the functions of the model', domainValueObjectClass, {
  valid: [
    service(
      'export function invoiceTotal(lines: readonly Money[]): Money { const rows = lines.map((line) => { return { line }; }); return rows.reduce((sum, { line }) => sum.add(line), Money.of(0)); }',
    ),
    service('export const isDue = (invoice: Invoice, now: Date): boolean => invoice.dueAt <= now;'),
    service(
      'export const dueOn = (day: Date) => ({ isSatisfiedBy: (invoice: Invoice): boolean => invoice.dueAt <= day, describe() { return String(day); } });',
    ),
    service(
      'export const dueOn = (day: Date) => { const isSatisfiedBy = (invoice: Invoice): boolean => invoice.dueAt <= day; return { isSatisfiedBy }; };',
    ),
    service('export const split = (total: Money) => ({ first: Money.of(1), rest: total.add(total) });'),
    service(
      'type State = { readonly status: string };\nexport const evolve = (state: State, status: string): State => ({ ...state, status });',
    ),
    service("const KEY = 'k';\nexport const spec = (n: number) => ({ [KEY]: (): number => n });"),
    service('export class InvoiceTotalService { total(): { cents: number } { return { cents: 0 }; } }'),
    classes(
      MACHINE,
      "export const invoiceLifecycle = defineStateMachine({ states: ['draft'], initial: ['draft'], transitions: {}, refused: () => ({ code: 'X' }) });",
    ),
    classes(HANDLER, PLAIN),
    classes(SPEC, PLAIN),
    classes('src/shared-kernel/presentation/money.schema.ts', PLAIN),
    classes(
      'src/shared-kernel/storable-stamp.ts',
      "import type { EventStamp } from '@ddd-ts-kit/kernel';\nexport function storableStamp(stamp: EventStamp): EventStamp { return { eventId: stamp.eventId, occurredAt: new Date(0), version: 1 }; }",
    ),
    at(SERVICE, PLAIN),
  ],
  invalid: [
    {
      ...service(
        'export function money(cents: number, currency: string) { const rounded = Math.round(cents); return { cents: rounded, currency }; }',
      ),
      errors: plainValue('money'),
    },
    { ...service(PLAIN), errors: plainValue('money') },
    {
      ...service('export const money = function (cents: number) { return { cents, currency: 0 } satisfies Money; };'),
      errors: plainValue('money'),
    },
    { ...service("export const money = <T,>(cents: T) => ({ cents, currency: 'EUR' });"), errors: plainValue('money') },
    {
      ...service('export { money };\nfunction money(cents: number, currency: string) { return { cents, currency }; }'),
      errors: plainValue('money'),
    },
    {
      ...service('const money = (cents: number, currency: string) => ({ cents, currency });\nexport { money };'),
      errors: plainValue('money'),
    },
    { ...service('export default (cents: number) => ({ cents, currency: 0 });'), errors: plainValue('default') },
    {
      ...service('const money = (cents: number) => ({ cents });\nexport default money;'),
      errors: plainValue('default'),
    },
    {
      ...service("export const decide = (reason: string) => { return { kind: 'refused' as const, reason }; };"),
      errors: plainValue('decide'),
    },
    {
      ...service('export const money = (cents: number) => ({ cents, doubled: (): number => cents * 2 });'),
      errors: plainValue('money'),
    },
    { ...classes(SHARED_PLAIN, PLAIN), errors: plainValue('money') },
  ],
});
