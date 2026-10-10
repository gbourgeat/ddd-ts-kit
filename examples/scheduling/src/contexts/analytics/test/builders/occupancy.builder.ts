import type { Occupancy } from '@/contexts/analytics/application/ports/occupancy-reader.port.js';

/** The occupancy of calendar-1 on 2026-10-12, with nothing held and nothing counted. */
export function anOccupancy(overrides: Partial<Occupancy> = {}): Occupancy {
  const calendarId = overrides.calendarId ?? 'calendar-1';
  const day = overrides.day ?? '2026-10-12';

  return {
    id: `${calendarId}.${day}`,
    practiceId: 'practice-1',
    calendarId,
    day,
    heldMinutes: 0,
    appointmentsHeld: 0,
    completed: 0,
    noShows: 0,
    cancelledByPatient: 0,
    cancelledByPractice: 0,
    ...overrides,
  };
}
