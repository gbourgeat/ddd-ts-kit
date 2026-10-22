import { acceptedSchema, Controller, type Accepted, type HttpRequest } from '@ddd-ts-kit/http';
import type { Actor, CommandBus } from '@ddd-ts-kit/kernel';
import { classSchema } from '@ddd-ts-kit/validation/class-validator';
import { RescheduleAppointmentCommand } from '@/contexts/scheduling/application/calendars/commands/reschedule-appointment/reschedule-appointment.command';
import { RescheduleAppointmentParams } from '@/contexts/scheduling/presentation/http/appointments/reschedule-appointment/reschedule-appointment.params';
import { RescheduleAppointmentBody } from '@/contexts/scheduling/presentation/http/appointments/reschedule-appointment/reschedule-appointment.body';
import { AppointmentsRoutes } from '@/contexts/scheduling/presentation/http/appointments.routes';

const params = classSchema(RescheduleAppointmentParams);
const body = classSchema(RescheduleAppointmentBody);

@Controller({
  group: AppointmentsRoutes,
  method: 'POST',
  path: '/:appointmentId/reschedule',
  summary: 'Reschedule appointment',
  params,
  body,
  response: { status: 201, description: 'Done; the body carries the identifier.', body: acceptedSchema },
  errors: [
    'APPOINTMENT_NOT_FOUND',
    'APPOINTMENT_ENDED',
    'UNKNOWN_CALENDAR',
    'UNKNOWN_APPOINTMENT_TYPE',
    'OUTSIDE_AVAILABILITY',
    'OFF_GRID',
    'BOOKING_TOO_LATE',
    'BOOKING_TOO_FAR',
    'SLOT_TAKEN',
    'PATIENT_LIMIT_REACHED',
  ],
})
export class RescheduleAppointmentController {
  constructor(private readonly commands: CommandBus) {}

  async handle(
    request: HttpRequest<{ params: RescheduleAppointmentParams; body: RescheduleAppointmentBody }>,
  ): Promise<Accepted> {
    const id = await this.commands.execute(moveOf(request.actor, request.params, request.body));

    return { id };
  }
}

function moveOf(
  actor: Actor,
  { appointmentId }: RescheduleAppointmentParams,
  { startsAt }: RescheduleAppointmentBody,
): RescheduleAppointmentCommand {
  return new RescheduleAppointmentCommand(actor, appointmentId, new Date(startsAt));
}
