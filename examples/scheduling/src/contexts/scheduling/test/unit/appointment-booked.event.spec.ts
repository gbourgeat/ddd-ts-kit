import { describe, expect, it } from 'vitest';
import { AppointmentBooked } from '#src/contexts/scheduling/domain/events/appointment-booked.event.js';
import { anAppointment } from '#src/contexts/scheduling/test/builders/appointment.builder.js';

const held = anAppointment().identifiedBy('appointment-1').build();

describe('AppointmentBooked', () => {
  it('is named after the context, the aggregate and the fact', () => {
    const event = new AppointmentBooked('appointment-1', new Date('2026-01-01T00:00:00.000Z'), {
      booking: held.booking,
    });

    expect(event.name).toBe('scheduling.appointment.booked');
    expect(event.aggregateId).toBe('appointment-1');
  });

  it('carries what a reaction needs to know', () => {
    const event = new AppointmentBooked('appointment-1', new Date('2026-01-01T00:00:00.000Z'), {
      booking: held.booking,
    });

    expect(event).toMatchObject({ held: { booking: held.booking } });
  });
});
