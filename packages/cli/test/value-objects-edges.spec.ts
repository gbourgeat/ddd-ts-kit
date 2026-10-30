import { describe, expect, it } from 'vitest';
import { closingAngle } from '../src/value-objects/closing-angle';
import { firstTypeArgument } from '../src/value-objects/first-type-argument';
import { inlineResults } from '../src/value-objects/inline-results';
import { isAssertedUse } from '../src/value-objects/is-asserted-use';
import { isConvertedCall } from '../src/value-objects/is-converted-call';
import { refusalAssertions } from '../src/value-objects/refusal-assertions';
import type { ResultMethods } from '../src/value-objects/result-methods';
import { statementEnd } from '../src/value-objects/statement-end';
import { ternaryReturns } from '../src/value-objects/ternary-returns';

const METHODS: ResultMethods = { statics: new Set(['Email.create']), instance: new Set() };

const use = (code: string, name: string): { code: string; source: string; at: number; name: string } => ({
  code,
  source: code,
  at: code.indexOf(name),
  name,
});

describe('the readers of the value object migration, on a text that ends before what they look for', () => {
  it('close an angle bracket, a type argument and a statement at the end of the text', () => {
    expect(closingAngle('<T', 0)).toBe(1);
    expect(firstTypeArgument('<T', 0)).toBe(2);
    expect(statementEnd('a', 0)).toBe(1);
  });

  it('see no call in a text whose parenthesis never opens', () => {
    expect(isConvertedCall('a)', { start: 0, end: 2 }, METHODS)).toBe(false);
  });

  it('leave a return whose branches are not ok and err', () => {
    const code = 'return a ? b : c;\n';

    expect(ternaryReturns(code, code)).toEqual([]);
  });
});

describe('a variable holding a Result, where it is read', () => {
  it('is asserted by expectRefusal when it is its first argument, and not by any other call', () => {
    expect(isAssertedUse(use("expectRefusal(result, 'X');", 'result'))).toBe(true);
    expect(isAssertedUse(use('log(result);', 'result'))).toBe(false);
  });

  it('is inlined into its assertions up to the end of a text no block closes', () => {
    const source = 'const result = Email.create(raw);\nexpect(result.ok).toBe(true);';

    expect(inlineResults(source, METHODS)).toBe('expect(Email.create(raw).ok).toBe(true);');
  });

  it('leaves an assertion on .ok of something that is not a converted call', () => {
    const source = 'expect(foo.ok).toBe(true);\n';

    expect(refusalAssertions(source, METHODS)).toEqual({ source, count: 0 });
  });
});
