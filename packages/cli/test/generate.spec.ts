import { beforeAll, describe, expect, it } from 'vitest';
import { cli, exists, read } from './helpers.js';
import { failure, report } from './reports.js';
import { explicitProject } from './support/explicit-project.js';

let root: string;

beforeAll(() => {
  root = explicitProject('generate');
});

describe('generate, the language first', () => {
  it('writes the production file, its builder and its spec at the canonical paths, and updates CONTEXT.md', () => {
    const result = report(cli(root, 'generate', 'aggregate', 'billing', 'invoice', '--json'));

    expect(result.created).toEqual([
      'src/contexts/billing/domain/aggregates/invoice.aggregate.ts',
      'src/contexts/billing/test/builders/invoice.builder.ts',
      'src/contexts/billing/test/unit/invoice.aggregate.spec.ts',
    ]);

    expect(result.updated).toEqual(expect.arrayContaining(['src/contexts/billing/CONTEXT.md']));

    expect(read(root, 'src/contexts/billing/CONTEXT.md')).toContain(
      '<!-- ddd-ts-kit:aggregates -->\n- `Invoice`\n<!-- /ddd-ts-kit:aggregates -->',
    );

    const aggregate = read(root, 'src/contexts/billing/domain/aggregates/invoice.aggregate.ts');

    expect(aggregate).toContain('private constructor(');
    expect(aggregate).toContain('static create(');
    expect(aggregate).toContain('static rehydrate(');

    expect(read(root, 'src/contexts/billing/test/builders/invoice.builder.ts')).toContain(
      'export class InvoiceBuilder extends Builder<InvoiceIngredients, Invoice>',
    );

    expect(read(root, 'src/contexts/billing/test/unit/invoice.aggregate.spec.ts')).toMatch(
      /given\(anInvoice\(\)\)\s+\.when\(.+\)\s+\.thenEvents\(\[\]\);/,
    );
  });

  it('refuses a name with a word the glossary does not define, and says how to add the term', () => {
    const refused = cli(root, 'generate', 'aggregate', 'billing', 'CreditNote', '--json');

    expect(refused.code).toBe(2);
    expect(failure(refused).message).toContain('"credit", "note"');
    expect(failure(refused).fix).toContain('use an existing term (Invoice, Issue)');
    expect(failure(refused).fix).toContain('--term "Credit=<what it means for the business>"');
    expect(exists(root, 'src/contexts/billing/domain/aggregates/credit-note.aggregate.ts')).toBe(false);
  });

  it('accepts inflected forms of a term: plural, past participle, -ing', () => {
    expect(cli(root, 'generate', 'domain-event', 'billing', 'Invoice', 'Issued', '--dry-run').code).toBe(0);
    expect(cli(root, 'generate', 'domain-service', 'billing', 'InvoiceIssuing', '--dry-run').code).toBe(0);
    expect(cli(root, 'generate', 'query', 'billing', 'IssuedInvoices', '--public', '--dry-run').code).toBe(0);
  });

  it('adds the terms given with --term to the glossary, then accepts the name', () => {
    const result = report(
      cli(root, 'generate', 'value-object', 'billing', 'Money', '--term', 'Money=An amount in a currency', '--json'),
    );

    expect(result.created).toContain('src/contexts/billing/domain/value-objects/money.vo.ts');

    expect(read(root, 'src/contexts/billing/CONTEXT.md')).toContain(
      '| Issue | To make an invoice final |  |\n| Money | An amount in a currency |  |',
    );

    expect(failure(cli(root, 'generate', 'entity', 'billing', 'Line', '--term', 'Line', '--json')).fix).toContain(
      '--term "<Term>=<what it means for the business>"',
    );
  });

  it('asks for the language first in a context whose glossary is empty', () => {
    const refused = cli(root, 'generate', 'aggregate', 'shipping', 'Parcel', '--json');

    expect(failure(refused).fix).toContain('define the ubiquitous language first');
  });

  it('refuses a technical word and an event that is not a fact, unless --allow-name', () => {
    expect(failure(cli(root, 'generate', 'aggregate', 'billing', 'InvoiceManager', '--json')).fix).toContain(
      'ubiquitous language',
    );

    expect(failure(cli(root, 'generate', 'entity', 'billing', 'InvoiceModel', '--json')).fix).toContain(
      'language/no-technical-name',
    );

    expect(failure(cli(root, 'generate', 'domain-event', 'billing', 'Invoice', 'Issue', '--json')).fix).toContain(
      'past tense',
    );

    expect(cli(root, 'generate', 'aggregate', 'billing', 'MarketData', '--allow-name', '--dry-run').code).toBe(0);

    expect(cli(root, 'generate', 'domain-event', 'billing', 'Invoice', 'Issue', '--allow-name', '--dry-run').code).toBe(
      0,
    );
  });
});

describe('generate, the next steps and the document of a new context', () => {
  it('lists every TODO(domain) of the created files as file:line', () => {
    const result = report(
      cli(root, 'generate', 'entity', 'billing', 'InvoiceLine', '--term', 'Line=One billed item', '--json'),
    );

    expect(result.next.length).toBeGreaterThan(0);
    expect(result.next).toEqual(result.todos.map((todo) => `${todo.file}:${todo.line}`));

    for (const todo of result.todos) {
      const line = read(root, todo.file).split('\n')[todo.line - 1] ?? '';

      expect(line).toContain('TODO(domain):');
      expect(line).toContain(todo.text.slice(0, 30));
    }
  });

  it('puts the definition of the language first in the next steps of a new context', () => {
    const result = report(
      cli(
        root,
        'generate',
        'context',
        'catalog',
        '--classification',
        'generic',
        '--upstream',
        'billing:conformist',
        '--json',
      ),
    );

    expect(result.next[0]).toMatch(/^src\/contexts\/catalog\/CONTEXT\.md:\d+$/);
    expect(result.todos[0]?.text).toContain('define the ubiquitous language first');

    expect(result.updated).toEqual(
      expect.arrayContaining([
        'ddd-ts-kit.config.json',
        'src/platform/compose-application.ts',
        'docs/context-map.md',
        'src/contexts/billing/CONTEXT.md',
      ]),
    );

    const config = JSON.parse(read(root, 'ddd-ts-kit.config.json')) as { contexts: Record<string, unknown> };

    expect(config.contexts['catalog']).toEqual({
      classification: 'generic',
      upstreams: [{ context: 'billing', relationship: 'conformist' }],
    });

    expect(read(root, 'src/platform/compose-application.ts')).toContain('catalogModule,');
    expect(read(root, 'src/contexts/catalog/CONTEXT.md')).toContain('- Downstream of `billing` (conformist).');
    expect(read(root, 'src/contexts/billing/CONTEXT.md')).toContain('- Upstream of `catalog` (conformist).');
  });

  it('writes the purpose and the terms given to a new context, and leaves markers otherwise', () => {
    cli(
      root,
      'generate',
      'context',
      'pricing',
      '--classification',
      'supporting',
      '--purpose',
      'Sets the price of every item. Owns price lists.',
      '--term',
      'Price list=The prices valid for a period',
    );

    const doc = read(root, 'src/contexts/pricing/CONTEXT.md');

    expect(doc).toContain('## Purpose\n\nSets the price of every item. Owns price lists.\n');

    expect(doc).toContain(
      '| Term | Meaning | Not to be confused with |\n|---|---|---|\n| Price list | The prices valid for a period |  |',
    );

    expect(doc).not.toContain('define the ubiquitous language first');

    expect(read(root, 'src/contexts/catalog/CONTEXT.md')).toContain(
      'TODO(domain): define the ubiquitous language first',
    );

    expect(read(root, 'docs/context-map.md')).toContain('| `pricing` | supporting | Sets the price of every item. |');
  });
});
