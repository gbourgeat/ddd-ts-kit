import { describe, expect, it } from 'vitest';
import { AppointmentConfirmed } from '#src/contexts/scheduling/domain/events/appointment-confirmed.event.js';
import { anAppointment } from '#src/contexts/scheduling/test/builders/appointment.builder.js';

const held = anAppointment().identifiedBy('appointment-1').build();

describe('AppointmentConfirmed', () => {
  it('is named after the context, the aggregate and the fact', () => {
    const event = new AppointmentConfirmed('appointment-1', new Date('2026-01-01T00:00:00.000Z'), held.booking);

    expect(event.name).toBe('scheduling.appointment.confirmed');
    expect(event.aggregateId).toBe('appointment-1');
  });

  it('carries what a reaction needs to know', () => {
    const event = new AppointmentConfirmed('appointment-1', new Date('2026-01-01T00:00:00.000Z'), held.booking);

    expect(event).toMatchObject({ booking: held.booking });
  });
});
