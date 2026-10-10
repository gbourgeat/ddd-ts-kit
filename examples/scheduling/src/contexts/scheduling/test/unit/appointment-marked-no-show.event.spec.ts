import { describe, expect, it } from 'vitest';
import { AppointmentMarkedNoShow } from '../../domain/events/appointment-marked-no-show.event.js';
import { anAppointment } from '../builders/appointment.builder.js';

const held = anAppointment().identifiedBy('appointment-1').build();

describe('AppointmentMarkedNoShow', () => {
  it('is named after the context, the aggregate and the fact', () => {
    const event = new AppointmentMarkedNoShow('appointment-1', new Date('2026-01-01T00:00:00.000Z'), held.booking);

    expect(event.name).toBe('scheduling.appointment.marked-no-show');
    expect(event.aggregateId).toBe('appointment-1');
  });

  it('carries what a reaction needs to know', () => {
    const event = new AppointmentMarkedNoShow('appointment-1', new Date('2026-01-01T00:00:00.000Z'), held.booking);

    expect(event).toMatchObject({ booking: held.booking });
  });
});
