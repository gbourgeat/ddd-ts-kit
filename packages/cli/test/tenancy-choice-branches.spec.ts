import { describe, expect, it } from 'vitest';
import { choiceBranches } from '../src/check/tenancy/choice-branches';

describe('the branches of a choice in a tenant condition', () => {
  it('reads both branches, past a choice nested in the first', () => {
    expect(choiceBranches('test ? a : b')).toEqual([' a ', ' b']);
    expect(choiceBranches('test ? (nested ? a : b) : c')).toEqual([' (nested ? a : b) ', ' c']);
    expect(choiceBranches('test ? nested ? a : b : c')).toEqual([' nested ? a : b ', ' c']);
  });

  it('takes neither an optional chain nor a nullish fallback for a choice', () => {
    expect(choiceBranches('filter?.tenant')).toBeUndefined();
    expect(choiceBranches('filter ?? fallback')).toBeUndefined();
    expect(choiceBranches('filter?.tenant ? a : b')).toEqual([' a ', ' b']);
  });

  it('leaves the second branch empty when the source stops before it, so the condition is not held', () => {
    expect(choiceBranches('test ? a')).toEqual([' a', '']);
  });
});
