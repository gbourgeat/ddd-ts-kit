import type { Rescheduling } from './application/commands/reschedule-appointment.command.js';

export function aRescheduling(more: Partial<Rescheduling> = {}): Rescheduling {
  return {
    appointmentId: 'apt-1',
    status: 'confirmed',
    startsAt: new Date('2026-03-04T09:30:00.000Z'),
    patientEmail: 'lin@example.org',
    note: 'Patient asked to come later because of a family matter',
    ...more,
  };
}
