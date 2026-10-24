import { describe, expect, it } from 'vitest';
import { affectedRows } from '../src/personal-data/affected-rows';

describe('affectedRows', () => {
  it('answers the rows the driver counted', () => {
    expect(affectedRows({ affected: 3 })).toBe(3);
    expect(affectedRows({ affected: 0 })).toBe(0);
  });

  it('answers none for a driver that does not count', () => {
    expect(affectedRows({})).toBe(0);
    expect(affectedRows({ affected: null })).toBe(0);
  });
});
