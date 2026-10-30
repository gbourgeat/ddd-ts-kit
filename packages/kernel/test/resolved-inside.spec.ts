import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { resolvedInside } from '../src/infrastructure/files/resolved-inside';

const ROOT = path.resolve('storage');

describe('the path of a file key under the directory of a storage', () => {
  it('stays under the directory', () => {
    expect(resolvedInside(ROOT, ['reports', 'march.pdf'])).toBe(path.join(ROOT, 'reports', 'march.pdf'));
  });

  it('refuses a key that climbs out of the directory', () => {
    expect(() => resolvedInside(ROOT, ['..', 'elsewhere'])).toThrow('resolved outside the directory');
  });

  it('refuses a neighbour whose name only starts like the directory', () => {
    expect(() => resolvedInside(ROOT, ['..', 'storage-of-another'])).toThrow('resolved outside the directory');
  });

  it('refuses the directory itself', () => {
    expect(() => resolvedInside(ROOT, [])).toThrow('resolved outside the directory');
  });
});
