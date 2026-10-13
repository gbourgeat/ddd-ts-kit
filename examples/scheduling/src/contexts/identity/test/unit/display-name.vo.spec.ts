import { describe, expect, it } from 'vitest';
import { DisplayName } from '@/contexts/identity/domain/value-objects/display-name.vo';
import { expectRefusal } from '@ddd-ts-kit/testing';

describe('DisplayName', () => {
  it('is equal to another display name with the same value', () => {
    const first = DisplayName.create('Ada Lovelace');
    const second = DisplayName.create('Ada Lovelace');

    expect(first.equals(second)).toBe(true);
  });

  it('refuses an empty value with a coded error', () => {
    expectRefusal(() => DisplayName.create('  '), 'INVALID_DISPLAY_NAME');
  });

  it.each(['A', 'Ada Lovelace', 'x'.repeat(120)])('accepts a name of 1 to 120 characters: %s', (name) => {
    expect(() => DisplayName.create(name)).not.toThrow();
  });

  it('refuses a name longer than 120 characters', () => {
    expectRefusal(() => DisplayName.create('x'.repeat(121)), 'INVALID_DISPLAY_NAME');
  });

  it('reads the same name whatever the spaces around and between its words', () => {
    const typed = DisplayName.create('  Ada   Lovelace ');

    expect(typed.value).toBe('Ada Lovelace');
  });
});
