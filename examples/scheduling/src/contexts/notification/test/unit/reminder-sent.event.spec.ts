import { describe, expect, it } from 'vitest';
import { ReminderSent } from '../../domain/events/reminder-sent.event.js';

describe('ReminderSent', () => {
  it('is named after the context, the aggregate and the fact', () => {
    const event = new ReminderSent('reminder-1', new Date('2026-01-01T00:00:00.000Z'), { recipientId: 'patient-1', appointmentId: 'appointment-1', startsAt: new Date('2026-01-02T00:00:00.000Z') });

    expect(event.name).toBe('notification.reminder.sent');
    expect(event.aggregateId).toBe('reminder-1');
  });
});
