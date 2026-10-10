import { describe, expect, it } from 'vitest';
import { AppointmentExpired } from '@/contexts/scheduling/domain/events/appointment-expired.event.js';
import { anAppointment } from '@/contexts/scheduling/test/builders/appointment.builder.js';

const held = anAppointment().identifiedBy('appointment-1').build();

describe('AppointmentExpired', () => {
  it('is named after the context, the aggregate and the fact', () => {
    const event = new AppointmentExpired('appointment-1', new Date('2026-01-01T00:00:00.000Z'), held.booking);

    expect(event.name).toBe('scheduling.appointment.expired');
    expect(event.aggregateId).toBe('appointment-1');
  });

  it('carries what a reaction needs to know', () => {
    const event = new AppointmentExpired('appointment-1', new Date('2026-01-01T00:00:00.000Z'), held.booking);

    expect(event).toMatchObject({ booking: held.booking });
  });
});
