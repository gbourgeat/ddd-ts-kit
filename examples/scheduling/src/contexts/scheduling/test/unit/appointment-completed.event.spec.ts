import { describe, expect, it } from 'vitest';
import { AppointmentCompleted } from '@/contexts/scheduling/domain/calendars/events/appointment-completed.event';
import { anAppointment } from '@/contexts/scheduling/test/builders/appointment.builder';

const held = anAppointment().identifiedBy('appointment-1').build();

describe('AppointmentCompleted', () => {
  it('is named after the context, the aggregate and the fact', () => {
    const event = new AppointmentCompleted('appointment-1', new Date('2026-01-01T00:00:00.000Z'), held.booking);

    expect(event.name).toBe('scheduling.appointment.completed');
    expect(event.aggregateId).toBe('appointment-1');
  });

  it('carries what a reaction needs to know', () => {
    const event = new AppointmentCompleted('appointment-1', new Date('2026-01-01T00:00:00.000Z'), held.booking);

    expect(event).toMatchObject({ booking: held.booking });
  });
});
