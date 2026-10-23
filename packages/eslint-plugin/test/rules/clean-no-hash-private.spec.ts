import { cleanNoHashPrivate } from '../../src/rules/clean-no-hash-private';
import { ruleTester } from '../support/rule-tester';

ruleTester.run('clean-no-hash-private', cleanNoHashPrivate, {
  valid: [
    'class Invoice { private total = 0; private add(amount: number): void { this.total += amount; } }',
    'class Invoice { constructor(private readonly id: string) {} }',
    "const object = { '#key': 1 };",
  ],
  invalid: [
    {
      code: 'class Invoice { #total = 0; add(amount: number): void { this.#total += amount; } }',
      output: 'class Invoice { private total = 0; add(amount: number): void { this.total += amount; } }',
      errors: [{ messageId: 'hash', data: { className: 'Invoice', name: 'total' } }],
    },
    {
      code: 'class Invoice { static readonly #count = 0; async #load(): Promise<void> {} static of(other: Invoice): number { void other.#load(); return Invoice.#count; } }',
      output: [
        'class Invoice { private static readonly count = 0; async #load(): Promise<void> {} static of(other: Invoice): number { void other.#load(); return Invoice.count; } }',
        'class Invoice { private static readonly count = 0; private async load(): Promise<void> {} static of(other: Invoice): number { void other.load(); return Invoice.count; } }',
      ],
      errors: [{ messageId: 'hash' }, { messageId: 'hash' }],
    },
    {
      code: 'class Invoice { get #paid(): boolean { return true; } set #paid(value: boolean) {} isPaid(): boolean { return this.#paid; } }',
      output:
        'class Invoice { private get paid(): boolean { return true; } private set paid(value: boolean) {} isPaid(): boolean { return this.paid; } }',
      errors: [{ messageId: 'hash' }, { messageId: 'hash' }],
    },
    {
      code: 'class Invoice { @observed() #total = 0; }',
      output: 'class Invoice { @observed() private total = 0; }',
      errors: [{ messageId: 'hash' }],
    },
    {
      code: 'class Invoice { #total = 0; total(): number { return this.#total; } }',
      output: null,
      errors: [{ messageId: 'hash' }],
    },
    {
      code: 'class Invoice { #total = 0; constructor(readonly total: number) {} }',
      output: null,
      errors: [{ messageId: 'hash' }],
    },
    {
      code: 'class Invoice { #brand = true; static is(value: object): boolean { return #brand in value; } }',
      output: null,
      errors: [{ messageId: 'hash' }],
    },
    {
      code: 'class Invoice { #lines = []; first(): unknown { return this.lines().#lines[0]; } lines(): Invoice { return this; } }',
      output: null,
      errors: [{ messageId: 'hash' }],
    },
    {
      code: 'class A { #id = 1; } class B { #id = 2; }',
      output: null,
      errors: [{ messageId: 'hash' }, { messageId: 'hash' }],
    },
    {
      code: 'const Invoice = class { #total = 0; };',
      output: 'const Invoice = class { private total = 0; };',
      errors: [{ messageId: 'hash', data: { className: 'the class', name: 'total' } }],
    },
  ],
});
