import { describe, expect, it } from 'vitest';
import { DomainError } from '@ddd-ts-kit/kernel';
import { InvalidNotificationKind } from '@/contexts/notification/domain/errors/invalid-notification-kind.error';

describe('InvalidNotificationKind', () => {
  it('refuses with the code INVALID_NOTIFICATION_KIND, its message and its facts', () => {
    const error = InvalidNotificationKind.forKind('newsletter');

    expect(error).toBeInstanceOf(DomainError);
    expect(error.code).toBe('INVALID_NOTIFICATION_KIND');

    expect(error.message).toBe(
      '"newsletter" is not a kind of notification: a request, a confirmation, a rescheduling, a cancellation or a reminder.',
    );

    expect(error.facts).toEqual({ given: 'newsletter' });
    expect(error.exposedFacts).toEqual({});
  });
});
