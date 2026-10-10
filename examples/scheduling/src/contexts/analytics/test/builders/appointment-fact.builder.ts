/** What every fact scheduling announces of an appointment carries: half an hour on calendar-1, on 2026-10-12. */
type AppointmentFact = {
  readonly appointmentId: string;
  readonly calendarId: string;
  readonly practiceId: string;
  readonly practitionerId: string;
  readonly patientId: string;
  readonly startsAt: string;
  readonly endsAt: string;
  readonly day: string;
};

export function anAppointmentFact(overrides: Partial<AppointmentFact> = {}): AppointmentFact {
  return {
    appointmentId: 'appointment-1',
    calendarId: 'calendar-1',
    practiceId: 'practice-1',
    practitionerId: 'practitioner-1',
    patientId: 'patient-1',
    startsAt: '2026-10-12T08:00:00.000Z',
    endsAt: '2026-10-12T08:30:00.000Z',
    day: '2026-10-12',
    ...overrides,
  };
}
