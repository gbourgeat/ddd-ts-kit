import { beforeAll, describe, expect, it } from 'vitest';
import { KINDS } from '../src/generate/kinds.js';
import { cli, exists, read, tempDir, write } from './helpers.js';
import { failure, report } from './reports.js';

describe('generate, the language first', () => {
  let root: string;

  beforeAll(() => {
    root = project('generate');
  });

  it('writes the production file, its builder and its spec at the canonical paths, and updates CONTEXT.md', () => {
    const result = report(cli(root, 'generate', 'aggregate', 'billing', 'invoice', '--json'));

    expect(result.created).toEqual([
      'src/contexts/billing/domain/aggregates/invoice.aggregate.ts',
      'src/contexts/billing/test/builders/invoice.builder.ts',
      'src/contexts/billing/test/unit/invoice.aggregate.spec.ts',
    ]);

    expect(result.updated).toEqual(expect.arrayContaining(['src/contexts/billing/CONTEXT.md']));
    expect(read(root, 'src/contexts/billing/CONTEXT.md')).toContain('<!-- ddd-ts-kit:aggregates -->\n- `Invoice`\n<!-- /ddd-ts-kit:aggregates -->');
    const aggregate = read(root, 'src/contexts/billing/domain/aggregates/invoice.aggregate.ts');

    expect(aggregate).toContain('private constructor(');
    expect(aggregate).toContain('static create(');
    expect(aggregate).toContain('static rehydrate(');
    expect(read(root, 'src/contexts/billing/test/builders/invoice.builder.ts')).toContain('export class InvoiceBuilder extends Builder<InvoiceIngredients, Invoice>');
    expect(read(root, 'src/contexts/billing/test/unit/invoice.aggregate.spec.ts')).toMatch(/given\(anInvoice\(\)\)\s+\.when\(.+\)\s+\.thenEvents\(\[\]\);/);
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
    const result = report(cli(root, 'generate', 'value-object', 'billing', 'Money', '--term', 'Money=An amount in a currency', '--json'));

    expect(result.created).toContain('src/contexts/billing/domain/value-objects/money.vo.ts');
    expect(read(root, 'src/contexts/billing/CONTEXT.md')).toContain('| Issue | To make an invoice final |  |\n| Money | An amount in a currency |  |');
    expect(failure(cli(root, 'generate', 'entity', 'billing', 'Line', '--term', 'Line', '--json')).fix).toContain('--term "<Term>=<what it means for the business>"');
  });

  it('asks for the language first in a context whose glossary is empty', () => {
    const refused = cli(root, 'generate', 'aggregate', 'shipping', 'Parcel', '--json');

    expect(failure(refused).fix).toContain('define the ubiquitous language first');
  });

  it('refuses a technical word and an event that is not a fact, unless --allow-name', () => {
    expect(failure(cli(root, 'generate', 'aggregate', 'billing', 'InvoiceManager', '--json')).fix).toContain('ubiquitous language');
    expect(failure(cli(root, 'generate', 'entity', 'billing', 'InvoiceModel', '--json')).fix).toContain('language/no-technical-name');
    expect(failure(cli(root, 'generate', 'domain-event', 'billing', 'Invoice', 'Issue', '--json')).fix).toContain('past tense');
    expect(cli(root, 'generate', 'aggregate', 'billing', 'MarketData', '--allow-name', '--dry-run').code).toBe(0);
    expect(cli(root, 'generate', 'domain-event', 'billing', 'Invoice', 'Issue', '--allow-name', '--dry-run').code).toBe(0);
  });

  it('lists every TODO(domain) of the created files as file:line', () => {
    const result = report(cli(root, 'generate', 'entity', 'billing', 'InvoiceLine', '--term', 'Line=One billed item', '--json'));

    expect(result.next.length).toBeGreaterThan(0);
    expect(result.next).toEqual(result.todos.map((todo) => `${todo.file}:${todo.line}`));

    for (const todo of result.todos) {
      const line = read(root, todo.file).split('\n')[todo.line - 1] ?? '';

      expect(line).toContain('TODO(domain):');
      expect(line).toContain(todo.text.slice(0, 30));
    }
  });

  it('puts the definition of the language first in the next steps of a new context', () => {
    const result = report(cli(root, 'generate', 'context', 'catalog', '--classification', 'generic', '--upstream', 'billing:conformist', '--json'));

    expect(result.next[0]).toMatch(/^src\/contexts\/catalog\/CONTEXT\.md:\d+$/);
    expect(result.todos[0]?.text).toContain('define the ubiquitous language first');
    expect(result.updated).toEqual(expect.arrayContaining(['ddd-ts-kit.config.json', 'src/platform/compose-application.ts', 'docs/context-map.md', 'src/contexts/billing/CONTEXT.md']));
    const config = JSON.parse(read(root, 'ddd-ts-kit.config.json')) as { contexts: Record<string, unknown> };

    expect(config.contexts['catalog']).toEqual({ classification: 'generic', upstreams: [{ context: 'billing', relationship: 'conformist' }] });
    expect(read(root, 'src/platform/compose-application.ts')).toContain('catalogModule,');
    expect(read(root, 'src/contexts/catalog/CONTEXT.md')).toContain('- Downstream of `billing` (conformist).');
    expect(read(root, 'src/contexts/billing/CONTEXT.md')).toContain('- Upstream of `catalog` (conformist).');
  });

  it('writes the purpose and the terms given to a new context, and leaves markers otherwise', () => {
    cli(root, 'generate', 'context', 'pricing', '--classification', 'supporting', '--purpose', 'Sets the price of every item. Owns price lists.', '--term', 'Price list=The prices valid for a period');
    const doc = read(root, 'src/contexts/pricing/CONTEXT.md');

    expect(doc).toContain('## Purpose\n\nSets the price of every item. Owns price lists.\n');
    expect(doc).toContain('| Term | Meaning | Not to be confused with |\n|---|---|---|\n| Price list | The prices valid for a period |  |');
    expect(doc).not.toContain('define the ubiquitous language first');
    expect(read(root, 'src/contexts/catalog/CONTEXT.md')).toContain('TODO(domain): define the ubiquitous language first');
    expect(read(root, 'docs/context-map.md')).toContain('| `pricing` | supporting | Sets the price of every item. |');
  });
});

describe('generate, plans and refusals', () => {
  let root: string;

  beforeAll(() => {
    root = project('generate');
    expect(cli(root, 'generate', 'aggregate', 'billing', 'Invoice').code).toBe(0);
  });

  it('prints the plan and writes nothing with --dry-run', () => {
    const result = cli(root, 'generate', 'domain-service', 'billing', 'InvoiceIssuing', '--dry-run');

    expect(result.stdout).toContain('would create src/contexts/billing/domain/services/invoice-issuing.service.ts');
    expect(exists(root, 'src/contexts/billing/domain/services/invoice-issuing.service.ts')).toBe(false);
  });

  it('never overwrites an existing file without --force', () => {
    const target = 'src/contexts/billing/domain/aggregates/invoice.aggregate.ts';

    write(root, target, 'export const edited = true;\n');

    const kept = report(cli(root, 'generate', 'aggregate', 'billing', 'Invoice', '--json'));

    expect(kept.skipped).toContain(target);
    expect(read(root, target)).toBe('export const edited = true;\n');

    const forced = report(cli(root, 'generate', 'aggregate', 'billing', 'Invoice', '--force', '--json'));

    expect(forced.updated).toContain(target);
    expect(read(root, target)).toContain('export class Invoice');
  });

  it('refuses an integration event handler of an upstream that is not declared, and says how to declare it', () => {
    const result = cli(root, 'generate', 'integration-handler', 'shipping', 'billing', 'billing.invoice.issued', '--json');

    expect(result.code).toBe(2);
    expect(failure(result).message).toContain('does not declare "billing" as an upstream');
    expect(failure(result).fix).toContain('contexts.shipping.upstreams');
    expect(failure(result).fix).toContain('"context": "billing"');
  });

  it('refuses what cannot compile yet and gives the command that creates the prerequisite', () => {
    const repository = cli(root, 'generate', 'repository', 'billing', 'Payment', '--json');

    expect(failure(repository).fix).toContain('ddd-ts-kit generate aggregate billing Payment');

    const builder = cli(root, 'generate', 'builder', 'billing', 'Payment', '--json');

    expect(failure(builder).fix).toContain('ddd-ts-kit generate aggregate billing Payment');

    const route = cli(root, 'generate', 'route', 'billing', 'PayInvoice', '--method', 'POST', '--path', '/payments', '--json');

    expect(failure(route).fix).toContain('ddd-ts-kit generate command billing PayInvoice');

    const e2e = cli(root, 'generate', 'e2e', 'billing', 'PayInvoice', '--json');

    expect(failure(e2e).fix).toContain('ddd-ts-kit generate route billing PayInvoice');
  });

  it('validates its arguments', () => {
    expect(failure(cli(root, 'generate', 'widget', 'billing', 'X', '--json')).message).toContain('Unknown kind');
    expect(failure(cli(root, 'generate', 'aggregate', 'billing', '--json')).message).toContain('expects 2 argument');
    expect(failure(cli(root, 'generate', 'aggregate', 'nowhere', 'Price', '--json')).message).toContain('Unknown context');
    expect(failure(cli(root, 'generate', 'context', 'returns', '--json')).fix).toContain('--classification');
    expect(failure(cli(root, 'generate', 'context', 'returns', '--classification', 'core', '--upstream', 'nowhere', '--json')).message).toContain('not declared');
    expect(failure(cli(root, 'generate', 'domain-error', 'billing', 'Refused', '--code', 'lower', '--json')).message).toContain('not a valid error code');
    expect(failure(cli(root, 'generate', 'aggregate', 'billing', 'Invoice', '--unknown', '--json')).message).toContain('--unknown');
  });

  it('describes the kinds in --help', () => {
    const help = cli(root, '--help').stdout;

    for (const kind of KINDS) expect(help).toContain(kind.usage);

    expect(KINDS.map((kind) => kind.name)).toEqual(expect.arrayContaining(['builder', 'e2e']));
  });
});

function project(label: string): string {
  const root = tempDir(label);

  expect(cli(root, 'init', '--style', 'explicit').code).toBe(0);
  expect(cli(root, 'generate', 'context', 'billing', '--classification', 'core', '--term', 'Invoice=A request for payment', '--term', 'Issue=To make an invoice final').code).toBe(0);
  expect(cli(root, 'generate', 'context', 'shipping', '--classification', 'supporting').code).toBe(0);

  return root;
}
