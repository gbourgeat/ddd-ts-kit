import { beforeAll, describe, expect, it } from 'vitest';
import { cli, read, tempDir, write } from './helpers';

const VO = 'src/contexts/billing/domain/value-objects/money.vo.ts';
const SPEC = 'src/contexts/billing/test/unit/money.vo.spec.ts';
const MONEY = ['--term', 'Money=An amount in a currency', '--term', 'Currency=The unit of an amount'];

describe('generate value-object, by the form the config says', () => {
  let root: string;

  beforeAll(() => {
    root = tempDir('value-objects');
    expect(cli(root, 'init').code).toBe(0);
    expect(cli(root, 'generate', 'context', 'billing', '--classification', 'core', ...MONEY).code).toBe(0);
  });

  it('records throwing factories for a new project, and writes one that returns the value or throws', () => {
    expect(JSON.parse(read(root, 'ddd-ts-kit.config.json'))).toMatchObject({ stack: { valueObjects: 'throwing' } });
    expect(cli(root, 'generate', 'value-object', 'billing', 'Money').code).toBe(0);

    const written = read(root, VO);

    expect(written).toContain('static create(value: string): Money {');
    expect(written).toContain("throw new InvariantViolation('Money must not be empty.');");
    expect(written).not.toContain('Result');
    expect(read(root, SPEC)).toContain("expectRefusal(() => Money.create('  '), 'INVARIANT_VIOLATION');");
    expect(read(root, SPEC)).not.toContain('unwrap');
    expect(read(root, '.claude/rules/domain.md')).toContain('with no `unwrap`');
  });

  it('writes a factory that returns a Result when the config says so, or says nothing', () => {
    for (const valueObjects of ['result', undefined]) {
      const config = JSON.parse(read(root, 'ddd-ts-kit.config.json')) as { stack: Record<string, unknown> };

      config.stack['valueObjects'] = valueObjects;
      write(root, 'ddd-ts-kit.config.json', JSON.stringify(config, null, 2));
      expect(cli(root, 'generate', 'value-object', 'billing', 'Currency', '--force').code).toBe(0);

      const vo = read(root, 'src/contexts/billing/domain/value-objects/currency.vo.ts');

      expect(vo).toContain('static create(value: string): Result<Currency, InvariantViolation> {');
      expect(vo).toContain("return err(new InvariantViolation('Currency must not be empty.'));");

      expect(read(root, 'src/contexts/billing/test/unit/currency.vo.spec.ts')).toContain(
        "const first = unwrap(Currency.create('sample'));",
      );
    }
  });

  it('keeps a recorded project without the key on Result through init --force, and refuses an unknown form', () => {
    expect(cli(root, 'init', '--force').code).toBe(0);
    expect(JSON.parse(read(root, 'ddd-ts-kit.config.json'))).toMatchObject({ stack: { valueObjects: 'result' } });
    expect(read(root, '.claude/rules/domain.md')).toContain('ddd-ts-kit value-objects` moves the project');
    expect(cli(tempDir('unknown-vo-form'), 'init', '--value-objects', 'nope').code).toBe(2);
  });
});
