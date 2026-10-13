import { describe, expect, it } from 'vitest';
import { Role } from '@/contexts/identity/domain/value-objects/role.vo';
import { expectRefusal } from '@ddd-ts-kit/testing';

describe('Role', () => {
  it('is equal to another role with the same value', () => {
    const first = Role.create('practitioner');
    const second = Role.create('practitioner');

    expect(first.equals(second)).toBe(true);
  });

  it('refuses an empty value with a coded error', () => {
    expectRefusal(() => Role.create('  '), 'UNKNOWN_ROLE');
  });

  it.each(['manager', 'practitioner', 'assistant'] as const)('accepts the role %s of a practice', (name) => {
    const role = Role.create(name);

    expect(role.is(name)).toBe(true);
  });

  it.each(['patient', 'admin', 'owner'])('refuses "%s", which nobody is in a practice', (name) => {
    expectRefusal(() => Role.create(name), 'UNKNOWN_ROLE');
  });

  it('reads the same role whatever its case and the spaces around it', () => {
    const typed = Role.create(' Manager ');

    expect(typed.equals(Role.manager())).toBe(true);
  });
});
