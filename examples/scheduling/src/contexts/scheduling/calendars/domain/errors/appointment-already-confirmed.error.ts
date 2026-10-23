import { DomainRefusal } from '@ddd-ts-kit/kernel';
import { SchedulingCodes } from '@/contexts/scheduling/scheduling.codes';

export class AppointmentAlreadyConfirmed extends DomainRefusal {
  readonly code = SchedulingCodes.AppointmentAlreadyConfirmed;

  static forAppointment(appointmentId: string) {
    return AppointmentAlreadyConfirmed.refusal(`Appointment ${appointmentId} is booked: nothing is left to confirm.`, {
      appointmentId,
    });
  }
}
