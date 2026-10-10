import { describe, expect, it } from 'vitest';
import { DomainError } from '@ddd-ts-kit/kernel';
import { ContactUnknownError } from '@/contexts/notification/domain/errors/contact-unknown.error.js';

describe('ContactUnknownError', () => {
  it('carries its stable code', () => {
    const error = new ContactUnknownError('patient-9');

    expect(error).toBeInstanceOf(DomainError);
    expect(error.code).toBe('CONTACT_UNKNOWN');
    expect(error.recipientId).toBe('patient-9');
  });
});
