import { describe, expect, it } from 'vitest';
import { unwrap } from '@ddd-ts-kit/kernel';
import { Cancellation } from '../../domain/value-objects/cancellation.vo.js';
import { AppointmentCancelled } from '../../domain/events/appointment-cancelled.event.js';
import { anAppointment } from '../builders/appointment.builder.js';

const held = anAppointment().identifiedBy('appointment-1').build();

describe('AppointmentCancelled', () => {
  it('is named after the context, the aggregate and the fact', () => {
    const event = new AppointmentCancelled('appointment-1', new Date('2026-01-01T00:00:00.000Z'), {
      booking: held.booking,
      cancellation: unwrap(Cancellation.create('practice', 'The practitioner is away.')),
    });

    expect(event.name).toBe('scheduling.appointment.cancelled');
    expect(event.aggregateId).toBe('appointment-1');
  });

  it('carries what a reaction needs to know', () => {
    const event = new AppointmentCancelled('appointment-1', new Date('2026-01-01T00:00:00.000Z'), {
      booking: held.booking,
      cancellation: unwrap(Cancellation.create('practice', 'The practitioner is away.')),
    });

    expect(event).toMatchObject({ ended: { booking: held.booking } });
    expect(event.ended.cancellation.by).toBe('practice');
    expect(event.ended.cancellation.reason).toBe('The practitioner is away.');
  });
});
