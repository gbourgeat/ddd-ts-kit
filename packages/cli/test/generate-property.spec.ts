import { describe, expect, it } from 'vitest';
import { cli, read, tempDir } from './helpers';
import { jsonAt } from './support/json-at';
import { readJson } from './support/read-json';
import { stringsAt } from './support/strings-at';

const SPEC = 'src/contexts/billing/test/unit/money.vo.properties.spec.ts';

describe('generate property', () => {
  it('writes the laws of a value object as a spec on generated values, and adds fast-check with the first one', () => {
    const root = billingWithMoney();

    const report = cli(root, 'generate', 'property', 'billing', 'Money', '--json').json();
    const spec = read(root, SPEC);

    expect(stringsAt(report, 'created')).toContain(SPEC);
    expect(spec).toContain("import fc from 'fast-check';");
    expect(spec).toContain("it('is equal to the money created again from its own value', () => {");
    expect(spec).toContain('function anyMoney(): fc.Arbitrary<Money> {');
    expect(spec).toContain('  return Money.create(value);');
    expect(jsonAt(readJson(root, 'package.json'), 'devDependencies', 'fast-check')).toBe('^4.10.2');
  });

  it('leaves package.json alone once fast-check is there, so that a worker runs it in its context', () => {
    const root = billingWithMoney();

    cli(root, 'generate', 'property', 'billing', 'Money');
    cli(root, 'generate', 'vo', 'billing', 'Currency', '--term', 'Currency=The unit an amount is counted in');

    const report = cli(root, 'generate', 'property', 'billing', 'Currency', '--local-only', '--json');

    expect(report.code).toBe(0);
    expect(stringsAt(report.json(), 'updated')).not.toContain('package.json');
  });

  it('unwraps the result of the factory in a project whose value objects return one', () => {
    const root = billingWithMoney('--value-objects', 'result');

    cli(root, 'generate', 'property', 'billing', 'Money');

    expect(read(root, SPEC)).toContain('  return unwrap(Money.create(value));');
  });

  it('refuses a value object that does not exist, and names the command that creates it', () => {
    const root = billingWithMoney();

    const refused = cli(root, 'generate', 'property', 'billing', 'Amount', '--allow-name');

    expect(refused.code).toBe(2);
    expect(refused.stderr).toContain('The value object Amount does not exist in "billing"');
    expect(refused.stderr).toContain('ddd-ts-kit generate value-object billing Amount');
  });
});

function billingWithMoney(...flags: string[]): string {
  const root = tempDir('property');

  cli(root, 'init', ...flags);
  cli(root, 'generate', 'context', 'billing', '--classification', 'core', '--purpose', 'Bills customers.');
  cli(root, 'generate', 'vo', 'billing', 'Money', '--term', 'Money=An amount in a currency');

  return root;
}
