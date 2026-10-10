import { describe, expect, it } from 'vitest';
import { given } from '@ddd-ts-kit/testing';
import { Reminder } from '#src/contexts/notification/domain/aggregates/reminder.aggregate.js';
import { ReminderNotDueError } from '#src/contexts/notification/domain/errors/reminder-not-due.error.js';
import { aReminder } from '#src/contexts/notification/test/builders/reminder.builder.js';

const startsAt = new Date('2026-03-10T09:00:00.000Z');
const dayBefore = new Date('2026-03-09T09:00:00.000Z');

describe('Reminder', () => {
  it('is born with its identity', () => {
    const bornAt = new Date('2026-03-01T00:00:00.000Z');

    const born = aReminder().identifiedBy('reminder-7').bornAt(bornAt).build();

    expect(born.id).toBe('reminder-7');
    expect(born.registeredAt).toEqual(bornAt);
  });

  it('is rehydrated in its stored state without recording a new fact', () => {
    const stored = aReminder().build();

    const loaded = Reminder.rehydrate(stored.id, stored.toState());

    expect(loaded.toState()).toEqual(stored.toState());
    expect(loaded.pullEvents()).toEqual([]);
  });

  it('is born planned, due 24 hours before the start of its appointment', () => {
    const born = aReminder().plannedFor(startsAt).build();

    expect(born.status).toBe('planned');
    expect(born.dueAt).toEqual(dayBefore);
    expect(born.pullEvents()).toEqual([]);
  });

  it('is not due earlier than 24 hours before the start', () => {
    const planned = aReminder().plannedFor(startsAt).build();

    expect(planned.isDue(new Date('2026-03-09T08:59:59.999Z'))).toBe(false);
    expect(planned.isDue(dayBefore)).toBe(true);
  });

  it('is sent once it is due, and records the fact with its recipient, its appointment and the start', () => {
    given(aReminder().identifiedBy('reminder-1').of('appointment-4').remindingOf('patient-9').plannedFor(startsAt))
      .when((subject) => {
        subject.send(dayBefore);
      })
      .thenEvents([
        {
          name: 'notification.reminder.sent',
          aggregateId: 'reminder-1',
          occurredAt: dayBefore,
          about: { recipientId: 'patient-9', appointmentId: 'appointment-4', startsAt },
        },
      ])
      .thenState((subject) => {
        expect(subject.status).toBe('sent');
      });
  });

  it('refuses to be sent before it is due', () => {
    given(aReminder().plannedFor(startsAt))
      .when((subject) => {
        subject.send(new Date('2026-03-08T09:00:00.000Z'));
      })
      .thenError(ReminderNotDueError, 'REMINDER_NOT_DUE');
  });

  it('refuses to be sent twice for the same start', () => {
    given(aReminder().plannedFor(startsAt).sent(dayBefore))
      .when((subject) => {
        subject.send(new Date('2026-03-09T09:15:00.000Z'));
      })
      .thenError(ReminderNotDueError, 'REMINDER_NOT_DUE');
  });

  it('refuses to be sent once the appointment has started', () => {
    given(aReminder().plannedFor(startsAt))
      .when((subject) => {
        subject.send(startsAt);
      })
      .thenError(ReminderNotDueError, 'REMINDER_NOT_DUE');
  });

  it('refuses to be sent once withdrawn', () => {
    given(aReminder().plannedFor(startsAt).withdrawn())
      .when((subject) => {
        subject.send(dayBefore);
      })
      .thenError(ReminderNotDueError, 'REMINDER_NOT_DUE');
  });

  it('changes nothing when planned again for the same start, even once sent', () => {
    const sent = aReminder().plannedFor(startsAt).sent(dayBefore).build();

    sent.planFor(new Date(startsAt));

    expect(sent.status).toBe('sent');
    expect(sent.dueAt).toEqual(dayBefore);
  });

  it('is due again, 24 hours before the new start, when its appointment moves', () => {
    const movedTo = new Date('2026-03-20T15:00:00.000Z');
    const sent = aReminder().plannedFor(startsAt).sent(dayBefore).build();

    sent.planFor(movedTo);

    expect(sent.status).toBe('planned');
    expect(sent.startsAt).toEqual(movedTo);
    expect(sent.dueAt).toEqual(new Date('2026-03-19T15:00:00.000Z'));
  });

  it('is withdrawn while planned, and stays sent once sent', () => {
    const planned = aReminder().plannedFor(startsAt).build();
    const sent = aReminder().plannedFor(startsAt).sent(dayBefore).build();

    planned.withdraw();
    sent.withdraw();

    expect(planned.status).toBe('withdrawn');
    expect(sent.status).toBe('sent');
  });
});
