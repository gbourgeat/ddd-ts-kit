import { defineBuilder, sequence } from '@ddd-ts-kit/testing';
import type { AgendaEntry } from '@/contexts/scheduling/application/calendars/ports/agenda.port';

/** An entry of the agenda as the projection writes it: a booked consultation on Monday 2 March 2026, changed by what the test states. */
export const anAgendaEntry = defineBuilder<AgendaEntry>({
  defaults: {
    id: sequence('appointment'),
    calendarId: 'calendar-1',
    practiceId: 'practice-1',
    practitionerId: 'practitioner-1',
    patientId: 'patient-1',
    appointmentTypeId: 'consultation',
    startsAt: new Date('2026-03-02T09:00:00.000Z'),
    endsAt: new Date('2026-03-02T09:30:00.000Z'),
    heldUntil: new Date('2026-03-02T09:30:00.000Z'),
    day: '2026-03-02',
    status: 'booked',
    confirmBefore: null,
    cancelledBy: null,
    internalNote: null,
    changedAt: new Date('2026-03-01T00:00:00.000Z'),
  },
});
