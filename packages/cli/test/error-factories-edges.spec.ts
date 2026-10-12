import { describe, expect, it } from 'vitest';
import { errorCodes } from '../src/check/errors/error-codes.js';
import { scan } from '../src/check/scan/scan.js';
import { addFactory } from '../src/generate/errors/add-factory.js';
import { addSpecCase } from '../src/generate/errors/add-spec-case.js';
import { factoryNameFor } from '../src/refusals/factory-name-for.js';
import { readLegacyError } from '../src/refusals/read-legacy-error.js';
import { readPlan } from '../src/refusals/read-plan.js';
import { renderFactory } from '../src/refusals/render-factory.js';
import { replaceInCode } from '../src/refusals/replace-in-code.js';
import { specParts } from '../src/refusals/spec-parts.js';
import { cli, read, tempDir, write } from './helpers.js';

const ORIGIN = { file: 'src/contexts/billing/domain/errors/ledger.error.ts', context: 'billing' };

const legacy = (body: string): string =>
  `import { DomainError } from '@ddd-ts-kit/kernel';\n\nexport class LedgerClosedError extends DomainError {\n  readonly code = 'LEDGER_CLOSED';\n${body}}\n`;

const MOVE = {
  className: 'LedgerClosedError',
  conceptClass: 'LedgerError',
  conceptFile: 'ledger.error',
  factory: 'closed',
  code: 'LEDGER_CLOSED',
  context: 'billing',
  legacyPath: 'billing/domain/errors/ledger-closed.error',
};

describe('reading a class per error', () => {
  it('reads its code, its parameters without their modifiers, its properties and its message', () => {
    const read = readLegacyError(
      legacy(
        '\n  constructor(readonly ledgerId: string, closedAt: Date, private readonly lines?: Line[], note = "none") {\n    super(`Ledger ${ledgerId} closed at ${closedAt.toISOString()}.`);\n  }\n',
      ),
      ORIGIN,
    );

    expect(read).toMatchObject({
      className: 'LedgerClosedError',
      code: 'LEDGER_CLOSED',
      properties: ['ledgerId', 'lines'],
      message: '`Ledger ${ledgerId} closed at ${closedAt.toISOString()}.`',
    });

    expect(read?.parameters).toEqual([
      { name: 'ledgerId', type: 'string' },
      { name: 'closedAt', type: 'Date' },
      { name: 'lines', type: 'Line[]' },
      { name: 'note', type: 'unknown' },
    ]);

    expect(read?.manual).toBeUndefined();
  });

  it('holds nothing of a file without a class per error', () => {
    expect(readLegacyError('export class LedgerError extends ConceptError {}\n', ORIGIN)).toBeUndefined();
    expect(readLegacyError('export class Ledger extends DomainError {}\n', ORIGIN)).toBeUndefined();
  });

  it.each([
    ['\n  constructor(cause: unknown) {\n    super("Closed.", { cause });\n  }\n', 'gives options to super'],
    ['\n  constructor(id: string) {\n    super("Closed.");\n    this.id = id;\n  }\n', 'reads or writes `this`'],
    ['\n  retryable(): boolean {\n    return false;\n  }\n', 'has members of its own'],
  ])('says why a class cannot move mechanically', (body, reason) => {
    expect(readLegacyError(legacy(body), ORIGIN)?.manual).toContain(reason);
  });

  it('gives an empty message to a constructor that calls super without one', () => {
    expect(readLegacyError(legacy('\n  constructor() {\n    super();\n  }\n'), ORIGIN)?.message).toBe("''");
  });

  it('keeps as facts the plain parameters only', () => {
    const parameters = [
      { name: 'ledgerId', type: 'string' },
      { name: 'lines', type: 'Line[]' },
      { name: 'days', type: 'readonly number[]' },
    ];

    const error = { ...ORIGIN, className: 'LedgerClosedError', code: 'LEDGER_CLOSED', parameters, properties: [] };

    expect(renderFactory({ ...error, message: "'Closed.'" }, MOVE)).toBe(
      "  static closed(ledgerId: string, lines: Line[], days: readonly number[]) {\n    return LedgerError.refusal('LEDGER_CLOSED', 'Closed.', { ledgerId, days });\n  }",
    );

    expect(renderFactory({ ...error, parameters: [], message: "'Closed.'" }, MOVE)).toContain(
      "refusal('LEDGER_CLOSED', 'Closed.');",
    );
  });
});

describe('the pieces of the migration', () => {
  it('names a factory after its code, without the concept at either end', () => {
    expect(factoryNameFor('APPOINTMENT_NOT_FOUND', 'Appointment')).toBe('notFound');
    expect(factoryNameFor('UNKNOWN_TIME_ZONE', 'TimeZone')).toBe('unknown');
    expect(factoryNameFor('SLOT_TAKEN', 'Appointment')).toBe('slotTaken');
    expect(factoryNameFor('SLOT_TAKEN', '')).toBe('slotTaken');
    expect(factoryNameFor('APPOINTMENT_ERROR', 'Appointment')).toBe('appointmentError');
  });

  it('refuses a plan that is not one', () => {
    expect(() => readPlan(undefined)).toThrow('holds no plan');
    expect(() => readPlan('[]')).toThrow('holds no plan');
    expect(() => readPlan('{"contexts":{"billing":[{"class":"X"}]}}')).toThrow('without its class, file or code');
    expect(readPlan('{"contexts":{"billing":"none"}}')).toEqual({ contexts: { billing: [] } });

    expect(
      readPlan(
        '{"contexts":{"billing":[{"class":"X","file":"x.ts","code":"NOT_FOUND","concept":"LedgerError","factory":"not-found"}]}}',
      ),
    ).toEqual({
      contexts: { billing: [{ class: 'X', file: 'x.ts', code: 'NOT_FOUND', concept: 'Ledger', factory: 'notFound' }] },
    });
  });

  it('cuts a spec into its imports and the cases of its describe', () => {
    expect(specParts("import { it } from 'vitest';\n\nit('alone', () => {});\n")).toEqual({
      imports: ["import { it } from 'vitest';\n"],
      cases: undefined,
    });

    expect(specParts("describe('X', () => {\n  it('a', () => {});\n});\n")).toEqual({
      imports: [],
      cases: "  it('a', () => {});",
    });
  });

  it('replaces in the code only, and keeps a match the replacement declines or that overlaps the previous one', () => {
    expect(replaceInCode('a(); // a()\nconst s = "a()";', /a\(\)/g, () => ({ text: 'b()' }))).toBe(
      'b(); // a()\nconst s = "a()";',
    );

    expect(replaceInCode('a(); a();', /a\(\)/g, ({ match }) => (match.index === 0 ? undefined : { text: 'b()' }))).toBe(
      'a(); b();',
    );

    expect(replaceInCode('aaaa', /aa/g, ({ match }) => ({ text: 'b', end: match.index + 3 }))).toBe('ba');
  });

  it('adds a factory to an empty class, and nothing to a source without the class or with the factory', () => {
    const empty = 'export class LedgerError extends ConceptError {}\n';
    const factory = { className: 'LedgerError', name: 'closed', text: '  static closed() {\n    return 1;\n  }' };

    expect(addFactory(empty, factory)).toBe(
      'export class LedgerError extends ConceptError {\n  static closed() {\n    return 1;\n  }\n}\n',
    );

    expect(addFactory('export class Other {}\n', factory)).toBeUndefined();
    expect(addFactory(addFactory(empty, factory) ?? '', factory)).toBe(addFactory(empty, factory));
    expect(addSpecCase("it('alone', () => {});\n", 'LedgerError.closed(', '  it()')).toBeUndefined();
    expect(addSpecCase('describe(name, suite);\n', 'LedgerError.closed(', '  it()')).toBeUndefined();
  });

  it('reads the codes of both forms, and none where the code is not a literal', () => {
    const source =
      "class A { static a() { return A.refusal('ONE', 'x'); } static b() { return A.refusal(CODE, 'x'); } }\nclass B { readonly code: string = 'TWO'; }\nclass C { readonly code = OTHER; }\n";

    expect(errorCodes(scan(source)).map(({ code }) => code)).toEqual(['ONE', 'TWO']);
  });
});

describe('error-factories, what it leaves to a person', () => {
  it('says the spec it could not merge and the factory that takes too many parameters', () => {
    const root = tempDir('error-factories-left');
    const errors = 'src/contexts/billing/domain/errors';

    cli(root, 'init', '--refusals', 'classes');
    cli(root, 'generate', 'context', 'billing', '--classification', 'core', '--term', 'Invoice=A request for payment');
    cli(root, 'generate', 'aggregate', 'billing', 'Invoice');

    write(
      root,
      `${errors}/invoice-refused.error.ts`,
      "import { DomainError } from '@ddd-ts-kit/kernel';\n\nexport class InvoiceRefusedError extends DomainError {\n  readonly code = 'INVOICE_REFUSED';\n\n  constructor(a: string, b: string, c: string, d: string) {\n    super(`${a} ${b} ${c} ${d}`);\n  }\n}\n",
    );

    write(
      root,
      'src/contexts/billing/test/unit/invoice-refused.error.spec.ts',
      "import { it } from 'vitest';\n\nit.todo('refuses');\n",
    );

    cli(root, 'error-factories', '--plan');

    const applied = cli(root, 'error-factories', '--apply', '--json').json() as { manual: string[] };

    expect(applied.manual.join('\n')).toContain('InvoiceError.refused takes more than three parameters');
    expect(applied.manual.join('\n')).toContain('invoice-refused.error.spec.ts: no describe block was found');

    expect(read(root, `${errors}/invoice.error.ts`)).toContain(
      'static refused(a: string, b: string, c: string, d: string) {',
    );

    expect(cli(root, 'describe', 'billing').stdout).toContain('INVOICE_REFUSED (InvoiceError.refused)');
  });
});
