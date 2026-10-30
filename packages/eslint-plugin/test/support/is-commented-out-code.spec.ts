import { describe, expect, it } from 'vitest';
import { isCommentedOutCode } from '../../src/support/comments/is-commented-out-code';

describe('isCommentedOutCode', () => {
  it('reads the shape of the line alone when the run has no parser', () => {
    expect(isCommentedOutCode('if (invoice.isPaid()) {', undefined)).toBe(true);
    expect(isCommentedOutCode('const total = lines.reduce(add, 0);', undefined)).toBe(false);
  });

  it('holds a statement without an expression, as a parser of another language answers, for prose', () => {
    const bare = { parse: () => ({ type: 'Program', body: [{ type: 'ExpressionStatement' }] }) };

    expect(isCommentedOutCode('run();', bare)).toBe(false);
  });
});
