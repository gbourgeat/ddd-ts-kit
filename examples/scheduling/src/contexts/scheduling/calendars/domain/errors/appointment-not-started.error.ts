import { DomainRefusal } from '@ddd-ts-kit/kernel';
import { SchedulingCodes } from '@/contexts/scheduling/scheduling.codes';

export class AppointmentNotStarted extends DomainRefusal {
  readonly code = SchedulingCodes.AppointmentNotStarted;

  static forAppointment(appointmentId: string, startsAt: Date) {
    return AppointmentNotStarted.refusal(
      `Appointment ${appointmentId} starts at ${startsAt.toISOString()}: its outcome is not known before.`,
      { appointmentId, startsAt },
    ).exposing('startsAt');
  }
}
