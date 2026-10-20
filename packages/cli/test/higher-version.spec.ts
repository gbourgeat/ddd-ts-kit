import { describe, expect, it } from 'vitest';
import { higherVersion } from '../src/merge/higher-version.js';

describe('the higher of two versions', () => {
  it.each([
    ['1.2.1', '1.3.0', '1.3.0'],
    ['1.10.0', '1.9.9', '1.10.0'],
    ['2.0.0', '2.0.0-rc.1', '2.0.0'],
    ['1.0.0-alpha', '1.0.0-alpha.1', '1.0.0-alpha.1'],
    ['1.0.0-alpha.beta', '1.0.0-alpha.1', '1.0.0-alpha.beta'],
    ['1.0.0-beta.11', '1.0.0-beta.2', '1.0.0-beta.11'],
    ['1.0.0-rc.1', '1.0.0-beta', '1.0.0-rc.1'],
  ])('ranks %s and %s by the precedence of Semantic Versioning: %s', (one, other, higher) => {
    expect(higherVersion(one, other)).toBe(higher);
    expect(higherVersion(other, one)).toBe(higher);
  });

  it('keeps the first of two versions that rank the same, build metadata ignored', () => {
    expect(higherVersion('1.2.0+trunk', '1.2.0+branch')).toBe('1.2.0+trunk');
  });

  it.each([
    ['next', '1.2.0'],
    ['1.2', '1.2.0'],
    ['v1.2.0', '1.2.0'],
    ['01.2.0', '1.2.0'],
    ['1.2.0-', '1.2.0'],
  ])('answers nothing when %s or %s is not a semantic version', (one, other) => {
    expect(higherVersion(one, other)).toBeUndefined();
    expect(higherVersion(other, one)).toBeUndefined();
  });
});
