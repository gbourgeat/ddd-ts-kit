import type { Outcome } from '#src/contexts/analytics/application/ports/outcome-register.port.js';

/** An appointment held for half an hour on calendar-1, on 2026-10-12. */
export function anOutcome(overrides: Partial<Outcome> = {}): Outcome {
  return {
    id: 'appointment-1',
    practiceId: 'practice-1',
    calendarId: 'calendar-1',
    day: '2026-10-12',
    startsAt: new Date('2026-10-12T08:00:00.000Z'),
    endsAt: new Date('2026-10-12T08:30:00.000Z'),
    state: 'held',
    changedAt: new Date('2026-10-01T10:00:00.000Z'),
    ...overrides,
  };
}
