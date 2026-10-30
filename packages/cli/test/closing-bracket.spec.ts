import { describe, expect, it } from 'vitest';
import { closingBracket } from '../src/check/text/closing-bracket';

describe('the bracket that closes an opening one', () => {
  it('is found past the brackets nested in between', () => {
    expect(closingBracket('f(a(b)[c]) + 1', 1)).toBe(9);
    expect(closingBracket('{ a: [1, 2] }', 0)).toBe(12);
  });

  it('is undefined when another kind of bracket closes first, or when nothing closes it', () => {
    expect(closingBracket('roles({ a: 1 )', 5)).toBeUndefined();
    expect(closingBracket('roles({ a: 1 ', 5)).toBeUndefined();
  });
});
