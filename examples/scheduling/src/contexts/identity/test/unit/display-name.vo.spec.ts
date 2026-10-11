import { describe, expect, it } from 'vitest';
import { unwrap } from '@ddd-ts-kit/kernel';
import { DisplayName } from '@/contexts/identity/domain/value-objects/display-name.vo';

describe('DisplayName', () => {
  it('is equal to another display name with the same value', () => {
    const first = unwrap(DisplayName.create('Ada Lovelace'));
    const second = unwrap(DisplayName.create('Ada Lovelace'));

    expect(first.equals(second)).toBe(true);
  });

  it('refuses an empty value with a coded error', () => {
    const result = DisplayName.create('  ');

    expect(result).toMatchObject({ ok: false, error: { code: 'INVALID_DISPLAY_NAME' } });
  });

  it.each(['A', 'Ada Lovelace', 'x'.repeat(120)])('accepts a name of 1 to 120 characters: %s', (name) => {
    const result = DisplayName.create(name);

    expect(result.ok).toBe(true);
  });

  it('refuses a name longer than 120 characters', () => {
    const result = DisplayName.create('x'.repeat(121));

    expect(result).toMatchObject({ ok: false, error: { code: 'INVALID_DISPLAY_NAME' } });
  });

  it('reads the same name whatever the spaces around and between its words', () => {
    const typed = unwrap(DisplayName.create('  Ada   Lovelace '));

    expect(typed.value).toBe('Ada Lovelace');
  });
});
