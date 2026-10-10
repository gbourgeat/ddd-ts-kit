import { describe, expect, it } from 'vitest';
import { Desk } from '#src/contexts/identity/domain/value-objects/desk.vo.js';

describe('Desk', () => {
  it('is equal to the desk of the same practitioner in the same practice', () => {
    const first = Desk.create('practice-1', 'person-1');
    const second = Desk.create('practice-1', 'person-1');

    expect(first.equals(second)).toBe(true);
  });

  it('differs from the desk of the same practitioner in another practice', () => {
    const first = Desk.create('practice-1', 'person-1');
    const second = Desk.create('practice-2', 'person-1');

    expect(first.equals(second)).toBe(false);
  });

  it('differs from the desk of another practitioner of the practice', () => {
    const first = Desk.create('practice-1', 'person-1');
    const second = Desk.create('practice-1', 'person-2');

    expect(first.equals(second)).toBe(false);
  });
});
