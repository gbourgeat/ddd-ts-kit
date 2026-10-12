import { describe, expect, it } from 'vitest';
import { unwrap } from '@ddd-ts-kit/kernel';
import { Membership } from '@/contexts/identity/domain/value-objects/membership.vo';
import { Role } from '@/contexts/identity/domain/value-objects/role.vo';

const practitioner = unwrap(Role.create('practitioner'));

describe('Membership', () => {
  it('is equal to another membership of the same person with the same role', () => {
    const first = Membership.create('person-1', practitioner);
    const second = Membership.create('person-1', practitioner);

    expect(first.equals(second)).toBe(true);
  });

  it('differs from the membership of the same person with another role', () => {
    const first = Membership.create('person-1', practitioner);
    const second = Membership.create('person-1', Role.manager());

    expect(first.equals(second)).toBe(false);
  });

  it('says whose membership it is', () => {
    const membership = Membership.create('person-1', practitioner);

    expect(membership.isOf('person-1')).toBe(true);
    expect(membership.isOf('person-2')).toBe(false);
  });

  it('says which role the member has', () => {
    const membership = Membership.create('person-1', practitioner);

    expect(membership.has('practitioner')).toBe(true);
    expect(membership.has('assistant')).toBe(false);
  });
});
