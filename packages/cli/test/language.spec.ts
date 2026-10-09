import { describe, expect, it } from 'vitest';
import { addGlossaryRows, parseGlossary, unknownWords } from '../src/check/glossary.js';
import { baseForms, sameWord } from '../src/check/inflection.js';
import { looksLikeCode } from '../src/check/rules/clean-no-commented-out-code.js';
import { restatesName } from '../src/check/rules/clean-no-noise-comment.js';
import { scan } from '../src/check/scanner.js';
import { readStructure } from '../src/check/structure.js';

const DOC = [
  '# Billing',
  '',
  '## Ubiquitous language',
  '',
  '| Term | Meaning | Not to be confused with |',
  '|---|---|---|',
  '| Invoice | A request for payment |  |',
  '| `Purchase order` | What was asked |  |',
  '| **Issue** | To make final |  |',
  '',
  '## Aggregates',
  '',
  '| Not | A glossary |',
].join('\n');

describe('glossary', () => {
  it('reads the terms of the first column, without their formatting, from its own section only', () => {
    expect(parseGlossary(DOC).terms).toEqual(['Invoice', 'Purchase order', 'Issue']);
    expect(parseGlossary('# Nothing').terms).toEqual([]);
  });

  it('finds the words of a name that no term covers', () => {
    const glossary = parseGlossary(DOC);

    expect(unknownWords('IssueInvoiceCommand', glossary)).toEqual([]);
    expect(unknownWords('PurchaseOrdersIssuedQuery', glossary)).toEqual([]);
    expect(unknownWords('InvoiceMarkedAsPaid', glossary)).toEqual(['marked', 'paid']);
    expect(unknownWords('InvoiceRepository', glossary)).toEqual([]);
    expect(unknownWords('InvoiceIssuedV2', glossary)).toEqual([]);
  });

  it('appends rows with as many cells as the table has, once', () => {
    const next = addGlossaryRows(DOC, [{ term: 'Pay', meaning: 'To settle' }, { term: 'invoice', meaning: 'again' }]) ?? '';

    expect(next).toContain('| **Issue** | To make final |  |\n| Pay | To settle |  |\n\n## Aggregates');
    expect(next.match(/\| invoice \|/gi)).toHaveLength(1);
    expect(addGlossaryRows('# No table', [{ term: 'Pay', meaning: 'To settle' }])).toBeUndefined();
  });
});

describe('inflection', () => {
  it.each([
    ['issued', 'issue'],
    ['issuing', 'issue'],
    ['invoices', 'invoice'],
    ['shipped', 'ship'],
    ['shipping', 'ship'],
    ['paid', 'pay'],
    ['categories', 'category'],
    ['addresses', 'address'],
    ['cancelled', 'cancel'],
    ['pricing', 'price'],
  ])('sees %s as a form of %s', (inflected, base) => {
    expect(sameWord(inflected, base)).toBe(true);
  });

  it('keeps different words apart', () => {
    expect(sameWord('invoice', 'order')).toBe(false);
    expect(sameWord('ship', 'shop')).toBe(false);
    expect(baseForms('Issued').has('issue')).toBe(true);
  });
});

describe('comment heuristics', () => {
  it.each([
    'const total = lines.reduce((sum, line) => sum + line.amount, 0);',
    'return invoice;',
    'if (invoice.issued) {',
    '}',
    'await repository.save(invoice);',
    "import { z } from 'zod';",
    'items.map((item) => item.id)',
    'invoice.issue()',
  ])('takes "%s" for code', (text) => {
    expect(looksLikeCode(text)).toBe(true);
  });

  it.each([
    'Rounded half-even: required by the tax authority (art. 242).',
    'The one intention under test. Synchronous actions give assertions that throw at once;',
    'If the invoice is already issued, the adapter answers the stored one.',
    'TODO(domain): record the fact with `created.record(new InvoiceCreated(id, now))`.',
    'See https://example.org/spec#section;',
    'ddd-ts-kit:imports',
  ])('takes "%s" for prose', (text) => {
    expect(looksLikeCode(text)).toBe(false);
  });

  it('tells a comment that only repeats the name from one that adds something', () => {
    expect(restatesName('Gets the order.', 'getOrder')).toBe(true);
    expect(restatesName('The invoice repository', 'InvoiceRepository')).toBe(true);
    expect(restatesName('Creates a new instance of the class.', 'constructor')).toBe(true);
    expect(restatesName('Gets the order, or the draft when none was placed.', 'getOrder')).toBe(false);
    expect(restatesName('Rounded half-even.', 'round')).toBe(false);
  });
});

describe('structure reader', () => {
  const source = [
    'export async function load<T>(url: string, options: { retries: number; hooks: Array<() => void> } = { retries: 1, hooks: [] }): Promise<{ value: T }> {',
    '  return parse(url, options);',
    '}',
    '',
    'function parse(a: string, b: unknown) {',
    '  return { value: a + String(b) };',
    '}',
    '',
    'export class Basket extends Base<Item> {',
    '  readonly #items = new Map<string, Item>();',
    '  static readonly limit = compute(1, 2);',
    '  handler = (a: number, b: number, c: number, d: number) => a + b + c + d;',
    '',
    '  private constructor(private readonly id: string, readonly owner: string) {',
    '    super();',
    '  }',
    '',
    '  static empty(id: string): Basket {',
    '    return new Basket(id, "nobody");',
    '  }',
    '',
    '  @Logged()',
    '  async add(item: Item, quantity = 1): Promise<void> {',
    '    if (quantity > 0) {',
    '      this.#store(item);',
    '    }',
    '  }',
    '',
    '  get size(): number {',
    '    return this.#items.size;',
    '  }',
    '',
    '  protected reset(): void {}',
    '',
    '  #store(item: Item): void {',
    '    this.#items.set(item.id, item);',
    '  }',
    '}',
  ].join('\n');
  const structure = readStructure(scan(source));

  it('reads top-level functions with their parameters, across generics and object types', () => {
    expect(structure.functions.map((shape) => [shape.name, shape.exported, shape.parameters.length, shape.bodyLines])).toEqual([
      ['load', true, 2, 1],
      ['parse', false, 2, 1],
    ]);
  });

  it('reads the methods of a class, not its property initialisers', () => {
    const [basket] = structure.classes;

    expect(basket?.name).toBe('Basket');
    expect(basket?.superclass).toBe('Base');
    expect(basket?.methods.map((method) => [method.name, method.visibility, method.isStatic, method.parameters.length, method.bodyLines])).toEqual([
      ['constructor', 'private', false, 2, 1],
      ['empty', 'public', true, 1, 1],
      ['add', 'public', false, 2, 3],
      ['size', 'public', false, 0, 1],
      ['reset', 'protected', false, 0, 0],
      ['#store', 'private', false, 1, 1],
    ]);
  });
});
