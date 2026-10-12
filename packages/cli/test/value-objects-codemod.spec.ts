import { beforeEach, describe, expect, it } from 'vitest';
import { cli, read, tempDir, write } from './helpers.js';

const VOS = 'src/contexts/billing/domain/value-objects';
const TESTS = 'src/contexts/billing/test/unit';

const lines = (...text: string[]): string => `${text.join('\n')}\n`;

const AMOUNT = lines(
  "import { ValueObject, err, ok, type Result } from '@ddd-ts-kit/kernel';",
  "import { InvoiceError } from '@/contexts/billing/domain/errors/invoice.error';",
  '',
  'export class Amount extends ValueObject<{ readonly cents: number }> {',
  '  static create(cents: number): Result<Amount, InvoiceError> {',
  '    if (cents < 0) {',
  '      return err(InvoiceError.negativeAmount(cents));',
  '    }',
  '',
  '    return ok(new Amount({ cents }));',
  '  }',
  '',
  '  static parse(text: string): Result<Amount, InvoiceError> {',
  '    return /^\\d+$/.test(text) ? ok(new Amount({ cents: Number(text) })) : err(InvoiceError.unreadable(text));',
  '  }',
  '',
  '  plus(other: Amount): Result<Amount, InvoiceError> {',
  '    return Amount.create(this.props.cents + other.props.cents);',
  '  }',
  '',
  '  pairs(): Result<Map<string, [number, number]>, InvoiceError> {',
  '    return ok(',
  "      new Map([['cents', [this.props.cents, 0]]]),",
  '    );',
  '  }',
  '}',
);

const SPEC = lines(
  "import { describe, expect, it } from 'vitest';",
  "import { unwrap } from '@ddd-ts-kit/kernel';",
  "import { Amount } from '@/contexts/billing/domain/value-objects/amount.vo';",
  '',
  "describe('Amount', () => {",
  "  it('adds', () => {",
  '    const sum = unwrap(unwrap(Amount.create(1)).plus(unwrap(Amount.create(2))));',
  '',
  '    expect(sum.equals(unwrap(',
  '      Amount.create(3),',
  '    ))).toBe(true);',
  '  });',
  '',
  "  it('refuses', () => {",
  '    const result = Amount.create(-1);',
  '',
  "    expect(result).toMatchObject({ ok: false, error: { code: 'NEGATIVE_AMOUNT' } });",
  "    expect(Amount.create(-2)).toMatchObject({\n      ok: false,\n      error: expect.objectContaining({ code: 'NEGATIVE_AMOUNT' }),\n    });",
  '    expect(Amount.create(-3).ok).toBe(false);',
  '    expect(Amount.parse("12").ok).toBe(true);',
  "    expectRefusal(Amount.parse('x'), 'UNREADABLE');",
  '  });',
  '',
  "  it('keeps a refusal with facts for a person', () => {",
  '    const kept = Amount.create(-1);',
  '',
  "    expect(kept).toMatchObject({ ok: false, error: { code: 'NEGATIVE_AMOUNT', facts: { cents: -1 } } });",
  '  });',
  '});',
);

describe('value-objects', () => {
  let root: string;

  beforeEach(() => {
    root = tempDir('value-objects-codemod');

    write(
      root,
      'ddd-ts-kit.config.json',
      JSON.stringify({ stack: { refusals: 'factories' }, contexts: { billing: {} } }),
    );

    write(root, `${VOS}/amount.vo.ts`, AMOUNT);

    write(
      root,
      `${TESTS}/amount.vo.spec.ts`,
      SPEC.replace('import { unwrap }', "import { expectRefusal } from '@ddd-ts-kit/testing';\nimport { unwrap }"),
    );
  });

  it('turns every method returning a Result into one that returns the value or throws', () => {
    expect(cli(root, 'value-objects').code).toBe(0);

    const vo = read(root, `${VOS}/amount.vo.ts`);

    expect(vo).toContain("import { ValueObject } from '@ddd-ts-kit/kernel';");
    expect(vo).toContain('static create(cents: number): Amount {');
    expect(vo).toContain('throw InvoiceError.negativeAmount(cents);');
    expect(vo).toContain('return new Amount({ cents });');
    expect(vo).toContain('plus(other: Amount): Amount {');
    expect(vo).toContain('pairs(): Map<string, [number, number]> {');
    expect(vo).toContain("return new Map([['cents', [this.props.cents, 0]]]);");

    expect(vo).toContain(
      'if (/^\\d+$/.test(text)) {\n      return new Amount({ cents: Number(text) });\n    }\n\n    throw InvoiceError.unreadable(text);',
    );

    expect(JSON.parse(read(root, 'ddd-ts-kit.config.json'))).toMatchObject({
      stack: { refusals: 'factories', valueObjects: 'throwing' },
    });
  });

  it('removes unwrap, asserts refusals on the factory, and says what it left', () => {
    const outcome = JSON.parse(cli(root, 'value-objects', '--json').stdout) as {
      manual: string[];
      unwraps: number;
      assertions: number;
      throws: number;
    };

    const spec = read(root, `${TESTS}/amount.vo.spec.ts`);

    expect(spec).toContain('const sum = Amount.create(1).plus(Amount.create(2));');
    expect(spec).toContain('expect(sum.equals(Amount.create(3))).toBe(true);');
    expect(spec).toContain("expectRefusal(() => Amount.create(-1), 'NEGATIVE_AMOUNT');");
    expect(spec).toContain("expectRefusal(() => Amount.create(-2), 'NEGATIVE_AMOUNT');");
    expect(spec).toContain('expect(() => Amount.create(-3)).toThrow();');
    expect(spec).toContain('expect(() => Amount.parse("12")).not.toThrow();');
    expect(spec).toContain("expectRefusal(() => Amount.parse('x'), 'UNREADABLE');");
    expect(spec).not.toContain('@ddd-ts-kit/kernel');
    expect(spec).toContain('const kept = Amount.create(-1);');
    expect(outcome).toMatchObject({ throws: 2, unwraps: 4, assertions: 5 });
    expect(outcome.manual[0]).toMatch(/amount\.vo\.spec\.ts:\d+ may still read a Result/);
  });

  it('leaves a function of the file and a method of another class that keep their Result', () => {
    const helper = lines(
      '',
      'export function tryParse(raw: string): Result<string, string> {',
      "  return raw.length > 0 ? ok(raw) : err('empty');",
      '}',
      '',
      'export class Ledger {',
      '  plus(cents: number): Result<number, string> {',
      "    return cents < 0 ? err('negative') : ok(cents);",
      '  }',
      '}',
    );

    write(root, `${VOS}/amount.vo.ts`, `${AMOUNT}${helper}`);
    write(root, 'src/contexts/billing/domain/services/ledger-use.ts', 'export const use = unwrap(ledger.plus(1));\n');
    expect(cli(root, 'value-objects').code).toBe(0);

    const vo = read(root, `${VOS}/amount.vo.ts`);

    expect(vo).toContain(helper);
    expect(vo).toContain('static create(cents: number): Amount {');
    expect(read(root, 'src/contexts/billing/domain/services/ledger-use.ts')).toContain('unwrap(ledger.plus(1))');
    expect(read(root, `${TESTS}/amount.vo.spec.ts`)).toContain('unwrap(Amount.create(1).plus(');
  });

  it('imports expectRefusal where an assertion now needs it, writes nothing on a dry run, and has nothing left to do after', () => {
    write(root, `${TESTS}/amount.vo.spec.ts`, SPEC);
    expect(cli(root, 'value-objects', '--dry-run').stdout).toContain(`would write   ${TESTS}/amount.vo.spec.ts`);
    expect(read(root, `${TESTS}/amount.vo.spec.ts`)).toBe(SPEC);

    expect(cli(root, 'value-objects').code).toBe(0);

    expect(read(root, `${TESTS}/amount.vo.spec.ts`)).toContain(
      "import { Amount } from '@/contexts/billing/domain/value-objects/amount.vo';\nimport { expectRefusal } from '@ddd-ts-kit/testing';",
    );

    expect(cli(root, 'value-objects').stdout).toBe('Nothing to do.');
  });
});
