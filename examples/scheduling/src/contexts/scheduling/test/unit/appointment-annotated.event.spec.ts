import { describe, expect, it } from 'vitest';
import { AppointmentAnnotated } from '@/contexts/scheduling/domain/events/appointment-annotated.event';

describe('AppointmentAnnotated', () => {
  it('is named after the context, the aggregate and the fact', () => {
    const event = new AppointmentAnnotated('appointment-1', new Date('2026-01-01T00:00:00.000Z'), 'Prefers mornings');

    expect(event.name).toBe('scheduling.appointment.annotated');
    expect(event.aggregateId).toBe('appointment-1');
    expect(event.internalNote).toBe('Prefers mornings');
  });
});
