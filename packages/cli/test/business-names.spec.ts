import { describe, expect, it } from 'vitest';
import { namedBindings } from '../src/check/business-names/named-bindings.js';
import { suggestedName } from '../src/check/business-names/suggested-name.js';
import { scan } from '../src/check/scan/scan.js';

function bindings(source: string): string[] {
  return namedBindings(scan(source).code).map((binding) => `${binding.kind} ${binding.name}`);
}

function suggestion(source: string): (string | undefined)[] {
  return namedBindings(scan(source).code).map(suggestedName);
}

describe('the names a source binds, read from its text', () => {
  it('reads variables, loop variables and destructured names at any depth', () => {
    expect(
      bindings(
        'const invoice = 1;\nlet { id: invoiceId, lines: [first, ...others], total = 0 } = invoice;\nfor (const line of lines) {}\nfor (const key in lines) {}\nconst [, second] = lines;\n',
      ),
    ).toEqual([
      'variable invoice',
      'destructured binding invoiceId',
      'destructured binding first',
      'destructured binding others',
      'destructured binding total',
      'loop variable line',
      'loop variable key',
      'destructured binding second',
    ]);
  });

  it('reads the parameters of functions, methods, signatures, arrows and function types', () => {
    expect(
      bindings(
        [
          'export function issue(invoice: Invoice, { lines }: Draft, ...notes: string[]): void {}',
          'const pay = async (payment: Payment): Promise<void> => {};',
          'const count = line => line.amount;',
          'const total = function (this: Invoice, amount = 0) {};',
          'export abstract class InvoiceRepository {',
          '  abstract findById(invoiceId: string): Promise<Invoice | undefined>;',
          '  constructor(private readonly clock: Clock, public ids: IdGenerator) {}',
          '  get label(): string {',
          '    return this.ids.next();',
          '  }',
          '}',
          'export interface Reader {',
          '  search(scope: AccessScope): Promise<Page<Line>>;',
          '  readonly onLine: (line: Line) => void;',
          '}',
        ].join('\n'),
      ),
    ).toEqual([
      'parameter invoice',
      'destructured binding lines',
      'parameter notes',
      'variable pay',
      'parameter payment',
      'variable count',
      'parameter line',
      'variable total',
      'parameter amount',
      'parameter invoiceId',
      'property clock',
      'property ids',
      'parameter scope',
      'property onLine',
      'parameter line',
    ]);
  });

  it('reads the properties of classes, interfaces and object types, never the keys of an object literal', () => {
    expect(
      bindings(
        [
          'export class Invoice {',
          '  private readonly lines: Line[] = [];',
          '  static readonly limit = 3;',
          '  issuedAt?: Date;',
          '  toLine(): Line {',
          '    return {',
          '      item: this.lines,',
          '    };',
          '  }',
          '}',
          'export type Draft = {',
          '  readonly customer: string;',
          '  readonly address: {',
          '    data: string;',
          '  };',
          '};',
          'enum Status {',
          '  Data = 1,',
          '}',
        ].join('\n'),
      ),
    ).toEqual(['property lines', 'property limit', 'property issuedAt', 'property customer', 'property address']);
  });

  it('does not read a call, a condition or a ternary as a signature', () => {
    expect(
      bindings(
        [
          'function run(): void {',
          '  notify(target);',
          '  if (ready(target)) {',
          '    send(target);',
          '  }',
          '  return ready(target) ? left(target) : right(target);',
          '}',
        ].join('\n'),
      ),
    ).toEqual([]);
  });
});

describe('the name the code already gives to what a binding holds', () => {
  it('is the class an initializer builds or the repository it reads', () => {
    expect(
      suggestion(
        [
          'const target = Appointment.create(id, now);',
          'const data = new PracticeMember(id);',
          'const item = await this.calendarRepository.findById(id);',
          'const things = await reminderRepository.findDue(now);',
          'const stuff = compute();',
          'const tmp = 1;',
          'const el = known ?? Person.create(id);',
          'const foo = (await this.waitlistRepository.findById(id)) ?? draft;',
        ].join('\n'),
      ),
    ).toEqual(['appointment', 'practiceMember', 'calendar', 'reminders', undefined, undefined, 'person', 'waitlist']);
  });

  it('is the singular of the collection a loop walks through, when it is a plural', () => {
    expect(
      suggestion(
        'for (const target of dueReminders) {}\nfor (const item of this.deliveries) {}\nfor (const el of due) {}\n',
      ),
    ).toEqual(['reminder', 'delivery', undefined]);
  });
});
