import { describe, expect, it } from 'vitest';
import { AppointmentAnnotated } from '@/contexts/scheduling/domain/calendars/events/appointment-annotated.event';
import { anAppointment } from '@/contexts/scheduling/test/builders/appointment.builder';

describe('AppointmentAnnotated', () => {
  it('is named after the context, the aggregate and the fact, and carries what is held with the note', () => {
    const { booking } = anAppointment().build();

    const event = new AppointmentAnnotated('appointment-1', new Date('2026-01-01T00:00:00.000Z'), {
      internalNote: 'Prefers mornings',
      booking,
    });

    expect(event.name).toBe('scheduling.appointment.annotated');
    expect(event.aggregateId).toBe('appointment-1');
    expect(event.annotated).toEqual({ internalNote: 'Prefers mornings', booking });
  });
});
