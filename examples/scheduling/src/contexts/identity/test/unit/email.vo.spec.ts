import { describe, expect, it } from 'vitest';
import { Email } from '@/contexts/identity/domain/value-objects/email.vo';
import { expectRefusal } from '@ddd-ts-kit/testing';

describe('Email', () => {
  it('is equal to another email with the same value', () => {
    const first = Email.create('ada@example.com');
    const second = Email.create('ada@example.com');

    expect(first.equals(second)).toBe(true);
  });

  it('refuses an empty value with a coded error', () => {
    expectRefusal(() => Email.create('  '), 'INVALID_EMAIL');
  });

  it.each(['ada@example.com', 'grace.hopper+desk@practice.example.org'])('accepts the address %s', (address) => {
    expect(() => Email.create(address)).not.toThrow();
  });

  it('accepts the longest address there is, 254 characters', () => {
    const longest = `${'a'.repeat(242)}@example.com`;

    expect(Email.create(longest).value).toHaveLength(254);
  });

  it.each([
    'ada',
    'ada@',
    '@example.com',
    'ada@example',
    'ada lovelace@example.com',
    'ada@example.com extra',
    `${'a'.repeat(250)}@example.com`,
  ])('refuses "%s", which nobody can be written to at', (address) => {
    expectRefusal(() => Email.create(address), 'INVALID_EMAIL');
  });

  it('reads the same address whatever its case and the spaces around it', () => {
    const typed = Email.create('  Ada@Example.COM ');

    expect(typed.value).toBe('ada@example.com');
    expect(typed.equals(Email.create('ada@example.com'))).toBe(true);
  });
});
