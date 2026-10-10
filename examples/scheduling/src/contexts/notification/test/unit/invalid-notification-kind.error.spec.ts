import { describe, expect, it } from 'vitest';
import { DomainError } from '@ddd-ts-kit/kernel';
import { InvalidNotificationKindError } from '#src/contexts/notification/domain/errors/invalid-notification-kind.error.js';

describe('InvalidNotificationKindError', () => {
  it('carries its stable code', () => {
    const error = new InvalidNotificationKindError('newsletter');

    expect(error).toBeInstanceOf(DomainError);
    expect(error.code).toBe('INVALID_NOTIFICATION_KIND');
  });
});
