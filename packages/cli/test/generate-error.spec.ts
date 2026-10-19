import { beforeAll, describe, expect, it } from 'vitest';
import { cli, exists, read, tempDir, write } from './helpers.js';
import { failure, report } from './reports.js';
import { billingProject as project, generateError as generate } from './support/billing-error-project.js';

const ERROR = 'src/contexts/billing/domain/errors/invoice.error.ts';
const SPEC = 'src/contexts/billing/test/unit/invoice.error.spec.ts';

describe('generate error, in a project of one error class per concept', () => {
  let root: string;

  beforeAll(() => {
    root = project('error', '--refusals', 'factories');
  });

  it('creates the error class of the concept with its first factory, and the spec', () => {
    const created = report(generate(root, 'Invoice', 'alreadyIssued'));

    expect(created.created).toEqual([ERROR, SPEC]);

    const [, , , , todo, ...rest] = read(root, ERROR).split('\n');

    expect(read(root, ERROR).split('\n').slice(0, 4)).toEqual([
      "import { ConceptError } from '@ddd-ts-kit/kernel';",
      '',
      'export class InvoiceError extends ConceptError {',
      '  static alreadyIssued() {',
    ]);

    expect(todo).toContain('// TODO(domain): take as parameters the facts that explain this refusal');
    expect(rest).toEqual(["    return InvoiceError.refusal('ALREADY_ISSUED', 'Already issued.');", '  }', '}', '']);

    expect(read(root, SPEC)).toContain(
      "import { InvoiceError } from '@/contexts/billing/domain/errors/invoice.error';",
    );

    expect(read(root, SPEC)).toContain("expect(error.code).toBe('ALREADY_ISSUED');");
  });

  it('adds a factory after the last one, and its case to the spec', () => {
    const added = report(generate(root, 'InvoiceError', 'not-found'));
    const source = read(root, ERROR);

    expect(added.updated).toEqual(expect.arrayContaining([ERROR, SPEC]));
    expect(source.indexOf('static alreadyIssued()')).toBeLessThan(source.indexOf('static notFound()'));
    expect(source).toContain("return InvoiceError.refusal('INVOICE_NOT_FOUND', 'Not found.');");
    expect(source).toMatch(/ {2}\}\n\n {2}static notFound\(\) \{/);
    expect(source.endsWith('  }\n}\n')).toBe(true);
    expect(read(root, SPEC)).toContain('const error = InvoiceError.notFound();');
    expect(read(root, SPEC).match(/^ {2}it\(/gm)).toHaveLength(2);
  });

  it('changes nothing when the factory is already there', () => {
    const before = [read(root, ERROR), read(root, SPEC)];
    const again = report(generate(root, 'Invoice', 'alreadyIssued'));

    expect([...again.created, ...again.updated]).toEqual([]);
    expect([read(root, ERROR), read(root, SPEC)]).toEqual(before);
  });

  it('keeps the factories above the members a class already has', () => {
    write(
      root,
      'src/contexts/billing/domain/errors/issue.error.ts',
      "import { ConceptError } from '@ddd-ts-kit/kernel';\n\nexport class IssueError extends ConceptError {\n  static refusedTwice(id: string) {\n    return IssueError.refusal('REFUSED_TWICE', `Twice: ${id}.`, { id });\n  }\n\n  get retryable(): boolean {\n    return false;\n  }\n}\n",
    );

    expect(generate(root, 'Issue', 'tooLate').code).toBe(0);

    const source = read(root, 'src/contexts/billing/domain/errors/issue.error.ts');

    expect(source.indexOf('static tooLate()')).toBeGreaterThan(source.indexOf('static refusedTwice('));
    expect(source.indexOf('static tooLate()')).toBeLessThan(source.indexOf('get retryable()'));
  });

  it('gives the concept as prefix to a code of one word or of the kit, and takes --code among the accepted forms', () => {
    expect(generate(root, 'Invoice', 'unknown').code).toBe(0);
    expect(generate(root, 'Invoice', 'forbidden').code).toBe(0);
    expect(generate(root, 'Invoice', 'alreadyPaid', '--code', 'INVOICE_ALREADY_PAID').code).toBe(0);
    expect(read(root, ERROR)).toContain("refusal('INVOICE_UNKNOWN'");
    expect(read(root, ERROR)).toContain("refusal('INVOICE_FORBIDDEN'");
    expect(read(root, ERROR)).toContain("refusal('INVOICE_ALREADY_PAID'");
  });

  it('refuses a vague name, a code that says something else and a code already taken in the context', () => {
    expect(failure(generate(root, 'Invoice', 'create')).message).toContain('says that an error is built');
    expect(failure(generate(root, 'Invoice', 'error1')).message).toContain('is not the name of a refusal');

    expect(failure(generate(root, 'Invoice', 'voided', '--code', 'BILLING_FAILED')).fix).toContain(
      'VOIDED, INVOICE_VOIDED, VOIDED_INVOICE',
    );

    expect(failure(generate(root, 'Issue', 'alreadyIssued')).message).toBe(
      `The code "ALREADY_ISSUED" is already set in ${ERROR}:6.`,
    );
  });

  it('holds the name of the concept to the glossary, and learns a term given in the command', () => {
    expect(failure(generate(root, 'Ledger', 'closed')).message).toContain('which the glossary of');
    expect(generate(root, 'Ledger', 'closed', '--term', 'Ledger=The book of what was billed').code).toBe(0);
    expect(read(root, 'src/contexts/billing/CONTEXT.md')).toContain('| Ledger | The book of what was billed |');
    expect(exists(root, 'src/contexts/billing/domain/errors/ledger.error.ts')).toBe(true);
  });

  it('produces what the checker accepts', () => {
    const checked = cli(root, 'check', '--json').json() as { violations: { ruleId: string; file: string }[] };

    expect(checked.violations.filter(({ file }) => file.includes('error'))).toEqual([]);
  });

  it('sends the old kind to the new one in a project that builds through factories', () => {
    const refused = failure(cli(root, 'generate', 'domain-error', 'billing', 'InvoiceVoided', '--json'));

    expect(refused.message).toContain('"stack.refusals": "factories"');
    expect(refused.fix).toContain('ddd-ts-kit generate error billing <Concept> <refusal>');
  });
});

describe('the errors of a context', () => {
  it('lists the errors of the context by class, refusal, code and exposed facts, in describe and in CONTEXT.md', () => {
    const root = project('error-listed', '--refusals', 'factories');

    expect(generate(root, 'Invoice', 'alreadyIssued').code).toBe(0);

    write(
      root,
      'src/contexts/billing/domain/errors/issue.error.ts',
      "import { ConceptError } from '@ddd-ts-kit/kernel';\n\nexport class IssueError extends ConceptError {\n  static refusedTwice(id: string, at: Date) {\n    return IssueError.refusal('REFUSED_TWICE', `Twice: ${id}.`, { id, at }).exposing('at', 'id');\n  }\n}\n",
    );

    expect(cli(root, 'docs').code).toBe(0);

    const described = cli(root, 'describe', 'billing', '--json').json() as { errors: Record<string, unknown>[] };

    expect(described.errors).toContainEqual({
      errorClass: 'IssueError',
      refusal: 'refusedTwice',
      code: 'REFUSED_TWICE',
      exposes: ['at', 'id'],
      file: 'src/contexts/billing/domain/errors/issue.error.ts',
    });

    expect(described.errors).toContainEqual(expect.objectContaining({ refusal: 'alreadyIssued', exposes: [] }));

    expect(cli(root, 'describe', 'billing').stdout).toContain(
      'REFUSED_TWICE (IssueError.refusedTwice, exposes at, id)',
    );

    expect(read(root, 'src/contexts/billing/CONTEXT.md')).toContain(
      '| `IssueError` | `refusedTwice` | `REFUSED_TWICE` | `at`, `id` |',
    );

    expect(read(root, 'src/contexts/billing/CONTEXT.md')).toContain(
      '| `InvoiceError` | `alreadyIssued` | `ALREADY_ISSUED` | none |',
    );
  });
});

describe('generate domain-error, in a project that keeps one class per error', () => {
  let root: string;

  beforeAll(() => {
    root = project('classes', '--refusals', 'classes');
  });

  it('records the choice and writes the class of 0.2', () => {
    expect(JSON.parse(read(root, 'ddd-ts-kit.config.json'))).toMatchObject({ stack: { refusals: 'classes' } });
    expect(cli(root, 'generate', 'domain-error', 'billing', 'InvoiceAlreadyIssued', '--allow-name').code).toBe(0);

    expect(read(root, 'src/contexts/billing/domain/errors/invoice-already-issued.error.ts')).toContain(
      "readonly code = 'INVOICE_ALREADY_ISSUED';",
    );

    expect(
      failure(cli(root, 'generate', 'domain-error', 'billing', 'Refused', '--code', 'lower', '--json')).message,
    ).toContain('not a valid error code');
  });

  it('lists a class per error under its own name', () => {
    expect(cli(root, 'describe', 'billing').stdout).toContain('INVOICE_ALREADY_ISSUED (InvoiceAlreadyIssuedError)');
    expect(cli(root, 'docs').code).toBe(0);

    expect(read(root, 'src/contexts/billing/CONTEXT.md')).toContain(
      '| `InvoiceAlreadyIssuedError` | the class itself | `INVOICE_ALREADY_ISSUED` | none |',
    );
  });

  it('accepts a factory too: both forms run in either project', () => {
    expect(generate(root, 'Invoice', 'notFound').code).toBe(0);
  });

  it('reads a config without the key as one class per error', () => {
    const config = JSON.parse(read(root, 'ddd-ts-kit.config.json')) as { stack: Record<string, unknown> };

    delete config.stack['refusals'];
    write(root, 'ddd-ts-kit.config.json', JSON.stringify(config, null, 2));

    expect(cli(root, 'generate', 'domain-error', 'billing', 'InvoiceVoided', '--allow-name').code).toBe(0);
    expect(cli(tempDir('unknown-form'), 'init', '--refusals', 'nope').code).toBe(2);
  });
});
