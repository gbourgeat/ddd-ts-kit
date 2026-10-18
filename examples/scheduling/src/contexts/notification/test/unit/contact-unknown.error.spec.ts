import { describe, expect, it } from 'vitest';
import { DomainError } from '@ddd-ts-kit/kernel';
import { ContactUnknown } from '@/contexts/notification/domain/errors/contact-unknown.error';

describe('ContactUnknown', () => {
  it('refuses with the code CONTACT_UNKNOWN, its message and its facts', () => {
    const error = ContactUnknown.forRecipient('patient-9');

    expect(error).toBeInstanceOf(DomainError);
    expect(error.code).toBe('CONTACT_UNKNOWN');
    expect(error.message).toBe('No contact is known for the recipient patient-9: nothing can be sent to them yet.');
    expect(error.facts).toEqual({ recipientId: 'patient-9' });
    expect(error.exposedFacts).toEqual({});
  });
});
