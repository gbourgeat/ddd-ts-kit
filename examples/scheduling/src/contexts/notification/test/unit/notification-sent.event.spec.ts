import { describe, expect, it } from 'vitest';
import { unwrap } from '@ddd-ts-kit/kernel';
import { NotificationSent } from '#src/contexts/notification/domain/events/notification-sent.event.js';
import { NotificationKind } from '#src/contexts/notification/domain/value-objects/notification-kind.vo.js';

describe('NotificationSent', () => {
  it('is named after the context, the aggregate and the fact', () => {
    const event = new NotificationSent('notification-1', new Date('2026-01-01T00:00:00.000Z'), {
      recipientId: 'patient-1',
      kind: unwrap(NotificationKind.create('confirmation')),
      appointmentId: 'appointment-1',
      startsAt: new Date('2026-01-02T00:00:00.000Z'),
    });

    expect(event.name).toBe('notification.notification.sent');
    expect(event.aggregateId).toBe('notification-1');
  });
});
