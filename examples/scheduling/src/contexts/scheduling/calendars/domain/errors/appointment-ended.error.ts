import { DomainRefusal } from '@ddd-ts-kit/kernel';
import { SchedulingCodes } from '@/contexts/scheduling/scheduling.codes';

export class AppointmentEnded extends DomainRefusal {
  readonly code = SchedulingCodes.AppointmentEnded;

  static forAppointment(appointmentId: string, status: string) {
    return AppointmentEnded.refusal(`Appointment ${appointmentId} is ${status} and does not change any more.`, {
      appointmentId,
      status,
    }).exposing('status');
  }
}
