import { describe, expect, it } from 'vitest';
import { unwrap } from '@ddd-ts-kit/kernel';
import { Email } from '../../domain/value-objects/email.vo.js';

describe('Email', () => {
  it('is equal to another email with the same value', () => {
    const first = unwrap(Email.create('ada@example.com'));
    const second = unwrap(Email.create('ada@example.com'));

    expect(first.equals(second)).toBe(true);
  });

  it('refuses an empty value with a coded error', () => {
    const result = Email.create('  ');

    expect(result).toMatchObject({ ok: false, error: { code: 'INVALID_EMAIL' } });
  });

  it.each(['ada@example.com', 'grace.hopper+desk@practice.example.org'])('accepts the address %s', (address) => {
    const result = Email.create(address);

    expect(result.ok).toBe(true);
  });

  it.each(['ada', 'ada@', '@example.com', 'ada@example', 'ada lovelace@example.com', `${'a'.repeat(250)}@example.com`])(
    'refuses "%s", which nobody can be written to at',
    (address) => {
      const result = Email.create(address);

      expect(result).toMatchObject({ ok: false, error: { code: 'INVALID_EMAIL' } });
    },
  );

  it('reads the same address whatever its case and the spaces around it', () => {
    const typed = unwrap(Email.create('  Ada@Example.COM '));

    expect(typed.value).toBe('ada@example.com');
    expect(typed.equals(unwrap(Email.create('ada@example.com')))).toBe(true);
  });
});
