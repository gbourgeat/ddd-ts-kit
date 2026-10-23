import { describe, expect, it } from 'vitest';
import { AppointmentRescheduled } from '@/contexts/scheduling/domain/calendars/events/appointment-rescheduled.event';
import { anAppointment } from '@/contexts/scheduling/test/builders/appointment.builder';

const held = anAppointment().identifiedBy('appointment-1').build();
const before = anAppointment().startingAt(new Date('2026-03-01T23:30:00.000Z')).onDay('2026-03-02').build();

describe('AppointmentRescheduled', () => {
  it('is named after the context, the aggregate and the fact', () => {
    const event = new AppointmentRescheduled('appointment-1', new Date('2026-01-01T00:00:00.000Z'), {
      booking: held.booking,
      previous: before.booking,
    });

    expect(event.name).toBe('scheduling.appointment.rescheduled');
    expect(event.aggregateId).toBe('appointment-1');
  });

  it('carries what a reaction needs to know', () => {
    const event = new AppointmentRescheduled('appointment-1', new Date('2026-01-01T00:00:00.000Z'), {
      booking: held.booking,
      previous: before.booking,
    });

    expect(event).toMatchObject({ moved: { booking: held.booking, previous: before.booking } });
  });
});
