import { describe, expect, it } from 'vitest';
import { DomainError } from '@ddd-ts-kit/kernel';
import { NotificationError } from '@/contexts/notification/domain/errors/notification.error';

const refusals = [
  {
    refusal: NotificationError.contactUnknown('patient-9'),
    code: 'CONTACT_UNKNOWN',
    message: 'No contact is known for the recipient patient-9: nothing can be sent to them yet.',
    facts: { recipientId: 'patient-9' },
    exposed: {},
  },
  {
    refusal: NotificationError.invalidNotificationKind('newsletter'),
    code: 'INVALID_NOTIFICATION_KIND',
    message:
      '"newsletter" is not a kind of notification: a request, a confirmation, a rescheduling, a cancellation or a reminder.',
    facts: { given: 'newsletter' },
    exposed: {},
  },
];

describe('NotificationError', () => {
  it.each(refusals)('refuses with $code, its message and its facts', ({ refusal, code, message, facts, exposed }) => {
    expect(refusal).toBeInstanceOf(DomainError);
    expect({ code: refusal.code, message: refusal.message, facts: refusal.facts }).toEqual({ code, message, facts });
    expect(refusal.exposedFacts).toEqual(exposed);
  });

  it('gives each refusal a code of its own', () => {
    expect(new Set(refusals.map(({ code }) => code)).size).toBe(refusals.length);
  });
});
