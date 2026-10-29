import { beforeAll, describe, expect, it } from 'vitest';
import { COMMON_FLAGS } from '../src/commands/generate';
import { KINDS } from '../src/generate/kinds';
import { cli, exists, read, write } from './helpers';
import { failure, report } from './reports';
import { explicitProject } from './support/explicit-project';

describe('generate, plans and refusals', () => {
  let root: string;

  beforeAll(() => {
    root = explicitProject('generate');
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
    const result = cli(
      root,
      'generate',
      'integration-handler',
      'shipping',
      'billing',
      'billing.invoice.issued',
      '--json',
    );

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

    const route = cli(
      root,
      'generate',
      'route',
      'billing',
      'PayInvoice',
      '--method',
      'POST',
      '--path',
      '/payments',
      '--json',
    );

    expect(failure(route).fix).toContain('ddd-ts-kit generate command billing PayInvoice');

    const e2e = cli(root, 'generate', 'e2e', 'billing', 'PayInvoice', '--json');

    expect(failure(e2e).fix).toContain('ddd-ts-kit generate route billing PayInvoice');
  });

  it('validates its arguments', () => {
    expect(failure(cli(root, 'generate', 'widget', 'billing', 'X', '--json')).message).toContain('Unknown kind');
    expect(failure(cli(root, 'generate', 'aggregate', 'billing', '--json')).message).toContain('expects 2 argument');

    expect(failure(cli(root, 'generate', 'aggregate', 'nowhere', 'Price', '--json')).message).toContain(
      'Unknown context',
    );

    expect(failure(cli(root, 'generate', 'context', 'returns', '--json')).fix).toContain('--classification');

    expect(
      failure(
        cli(root, 'generate', 'context', 'returns', '--classification', 'core', '--upstream', 'nowhere', '--json'),
      ).message,
    ).toContain('not declared');

    expect(
      failure(
        cli(root, 'generate', 'error', 'billing', 'InvoiceAlreadyIssued', 'forInvoice', '--code', 'lower', '--json'),
      ).message,
    ).toContain('"lower" is not a valid error code');

    expect(failure(cli(root, 'generate', 'aggregate', 'billing', 'Invoice', '--unknown', '--json')).message).toContain(
      '--unknown',
    );
  });

  it('knows --search only: the former --list is an unknown option and writes nothing', () => {
    const result = cli(
      root,
      'generate',
      'query',
      'billing',
      'SearchInvoices',
      '--permission',
      'invoice.search',
      '--list',
    );

    expect(result.code).toBe(2);
    expect(result.stderr).toContain("Unknown option '--list'");
    expect(exists(root, 'src/contexts/billing/application/queries/search-invoices')).toBe(false);
  });

  it('describes the kinds in --help', () => {
    const help = cli(root, '--help').stdout;

    for (const kind of KINDS) {
      expect(help).toContain(kind.usage);
    }

    expect(KINDS.map((kind) => kind.name)).toEqual(expect.arrayContaining(['builder', 'e2e']));
  });
});

describe('generate, a flag the kind does not take', () => {
  let root: string;

  beforeAll(() => {
    root = explicitProject('generate-flags');
  });

  it('refuses a flag another kind takes and this one does not, rather than ignoring it, and writes nothing', () => {
    const result = cli(root, 'generate', 'command', 'billing', 'VoidInvoice', '--public', '--search', '--json');

    expect(failure(result).message).toBe('generate command does not take --search: it would be ignored.');
    expect(failure(result).fix).toContain('Usage: ddd-ts-kit generate command <context> <UseCaseName>');
    expect(exists(root, 'src/contexts/billing/application/commands/void-invoice')).toBe(false);
  });

  it.each([
    ['route', ['--method', 'POST', '--path', '/invoices', '--command']],
    ['controller', ['--method', 'POST', '--path', '/invoices', '--command']],
    ['repository', []],
    ['port', []],
  ])('refuses --term on a %s, whose names the glossary does not judge, and says where the term goes', (kind, flags) => {
    const term = ['--term', 'Void=Cancel an issued invoice'];
    const result = cli(root, 'generate', kind, 'billing', 'Invoice', ...flags, ...term, '--json');

    expect(failure(result).message).toBe(`generate ${kind} does not take --term: it would be ignored.`);
    expect(failure(result).fix).toContain('give --term to the kind that names the concept first');
    expect(failure(result).fix).toContain(`Usage: ddd-ts-kit generate ${kind} <context>`);
    expect(read(root, 'src/contexts/billing/CONTEXT.md')).not.toContain('| Void |');
  });
});

describe('generate, the flags every kind takes', () => {
  let root: string;

  beforeAll(() => {
    root = explicitProject('generate-common-flags');
  });

  it('states them once, on the generate line of the help', () => {
    expect(cli(root, '--help').stdout).toContain(
      `ddd-ts-kit generate <kind> ... ${COMMON_FLAGS.map((flag) => `[--${flag}]`).join(' ')}     (alias: g)`,
    );
  });

  it.each(COMMON_FLAGS)('takes --%s on a kind whose usage does not show it', (flag) => {
    expect(cli(root, 'generate', 'port', 'billing', 'Ledger', `--${flag}`, '--dry-run').code).toBe(0);
  });
});
