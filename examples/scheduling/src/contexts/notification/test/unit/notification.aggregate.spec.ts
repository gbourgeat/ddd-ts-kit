import { describe, expect, it } from 'vitest';
import { given } from '@ddd-ts-kit/testing';
import { Notification } from '@/contexts/notification/domain/aggregates/notification.aggregate.js';
import { aNotification } from '@/contexts/notification/test/builders/notification.builder.js';

describe('Notification', () => {
  it('is born with its identity', () => {
    const bornAt = new Date('2026-03-01T00:00:00.000Z');

    const born = aNotification().identifiedBy('notification-7').bornAt(bornAt).build();

    expect(born.id).toBe('notification-7');
    expect(born.registeredAt).toEqual(bornAt);
  });

  it('is rehydrated in its stored state without recording a new fact', () => {
    const stored = aNotification().build();

    const loaded = Notification.rehydrate(stored.id, stored.toState());

    expect(loaded.toState()).toEqual(stored.toState());
    expect(loaded.pullEvents()).toEqual([]);
  });

  it('records nothing once it is sent: a sent notification does not change', () => {
    given(aNotification())
      .when((subject) => subject.toState())
      .thenNoEvent();
  });

  it('is born sent, and records the fact with what it told and to whom', () => {
    const startsAt = new Date('2026-03-05T14:30:00.000Z');
    const sentAt = new Date('2026-03-01T08:00:00.000Z');

    const born = aNotification()
      .identifiedBy('notification-1')
      .sentTo('patient-9')
      .ofKind('rescheduling')
      .about('appointment-4', startsAt)
      .bornAt(sentAt)
      .build();

    expect(born.pullEvents()).toMatchObject([
      {
        name: 'notification.notification.sent',
        aggregateId: 'notification-1',
        occurredAt: sentAt,
        about: { recipientId: 'patient-9', appointmentId: 'appointment-4', startsAt },
      },
    ]);
  });

  it('keeps the recipient, the kind, the appointment and its start it told about', () => {
    const startsAt = new Date('2026-03-05T14:30:00.000Z');

    const born = aNotification().sentTo('patient-9').ofKind('cancellation').about('appointment-4', startsAt).build();

    expect(born.recipientId).toBe('patient-9');
    expect(born.kind.value).toBe('cancellation');
    expect(born.appointmentId).toBe('appointment-4');
    expect(born.startsAt).toEqual(startsAt);
  });

  it('remembers the cause that made it necessary', () => {
    const born = aNotification().causedBy('event-42').build();

    expect(born.toState().cause).toBe('event-42');
  });
});
