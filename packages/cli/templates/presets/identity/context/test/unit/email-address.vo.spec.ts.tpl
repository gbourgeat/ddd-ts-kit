import { describe, expect, it } from '{{tests.module}}';
import { expectRefusal } from '@ddd-ts-kit/testing';
import { EmailAddress } from '{{alias.context}}/domain/value-objects/email-address.vo{{alias.ext}}';

describe('Email address', () => {
  it('is one address whatever the case and the spaces around it', () => {
    const typed = EmailAddress.create('  Ada.Lovelace@Example.ORG ');

    expect(typed.value).toBe('ada.lovelace@example.org');
    expect(typed.equals(EmailAddress.create('ada.lovelace@example.org'))).toBe(true);
  });

  it.each([
    '',
    'ada',
    'ada@',
    '@example.org',
    'ada@example',
    'ada lovelace@example.org',
    `${'a'.repeat(250)}@example.org`,
  ])('refuses "%s", which is no address', (raw) => {
    expectRefusal(() => EmailAddress.create(raw), 'INVALID_EMAIL_ADDRESS', { raw });
  });
});
