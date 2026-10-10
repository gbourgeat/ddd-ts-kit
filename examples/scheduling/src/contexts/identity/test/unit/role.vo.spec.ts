import { describe, expect, it } from 'vitest';
import { unwrap } from '@ddd-ts-kit/kernel';
import { Role } from '../../domain/value-objects/role.vo.js';

describe('Role', () => {
  it('is equal to another role with the same value', () => {
    const first = unwrap(Role.create('practitioner'));
    const second = unwrap(Role.create('practitioner'));

    expect(first.equals(second)).toBe(true);
  });

  it('refuses an empty value with a coded error', () => {
    const result = Role.create('  ');

    expect(result).toMatchObject({ ok: false, error: { code: 'UNKNOWN_ROLE' } });
  });

  it.each(['manager', 'practitioner', 'assistant'] as const)('accepts the role %s of a practice', (name) => {
    const role = unwrap(Role.create(name));

    expect(role.is(name)).toBe(true);
  });

  it.each(['patient', 'admin', 'owner'])('refuses "%s", which nobody is in a practice', (name) => {
    const result = Role.create(name);

    expect(result).toMatchObject({ ok: false, error: { code: 'UNKNOWN_ROLE' } });
  });

  it('reads the same role whatever its case and the spaces around it', () => {
    const typed = unwrap(Role.create(' Manager '));

    expect(typed.equals(Role.manager())).toBe(true);
  });
});
