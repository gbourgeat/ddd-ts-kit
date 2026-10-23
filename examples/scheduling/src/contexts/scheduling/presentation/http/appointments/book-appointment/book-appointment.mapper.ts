import { RequestMapper, type HttpRequest } from '@ddd-ts-kit/http';
import { BookAppointmentCommand } from '@/contexts/scheduling/application/calendars/commands/book-appointment/book-appointment.command';
import type { BookAppointmentBody } from '@/contexts/scheduling/presentation/http/appointments/book-appointment/book-appointment.body';

/** The one place that turns the request to book and its actor into the command. */
@RequestMapper()
export class BookAppointmentMapper
  implements RequestMapper<HttpRequest<{ body: BookAppointmentBody }>, BookAppointmentCommand>
{
  map({ actor, body }: HttpRequest<{ body: BookAppointmentBody }>): BookAppointmentCommand {
    const { calendarId, appointmentTypeId, startsAt, patientId, internalNote } = body;

    // Without a patient named, the caller books for themselves.
    const wish = {
      patientId: patientId ?? actor.id,
      appointmentTypeId,
      startsAt: new Date(startsAt),
      ...(internalNote === undefined ? {} : { internalNote }),
    };

    return new BookAppointmentCommand(actor, calendarId, wish);
  }
}
