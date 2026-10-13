import { Controller, defineForm, withFieldAccess, type HttpRequest } from '@ddd-ts-kit/http';
import type { CommandBus } from '@ddd-ts-kit/kernel';
import { classSchema } from '@ddd-ts-kit/validation/class-validator';
import { BookAppointmentBody } from '@/contexts/scheduling/presentation/http/appointments/book-appointment/book-appointment.body';
import { BookAppointmentAccepted } from '@/contexts/scheduling/presentation/http/appointments/book-appointment/book-appointment.accepted';
import type { BookAppointmentMapper } from '@/contexts/scheduling/presentation/http/appointments/book-appointment/book-appointment.mapper';
import { AppointmentsRoutes } from '@/contexts/scheduling/presentation/http/appointments.routes';
import { schedulingPermissions } from '@/contexts/scheduling/application/authorization/scheduling.permissions';

// The staff of the practice sees the internal note, the holder of the desk (or the manager) writes it: an assistant who
// books on a delegated desk reads it; a patient neither sees nor sends it.
const body = withFieldAccess(classSchema(BookAppointmentBody), {
  internalNote: {
    read: { permission: schedulingPermissions['appointment.note.read'] },
    write: { permission: schedulingPermissions['appointment.note.write'] },
    subject: (booking) => ({ type: 'calendar', id: booking.calendarId }),
  },
});

const accepted = classSchema(BookAppointmentAccepted);

/**
 * How the body of the route is entered, served as a form at GET /forms/bookAppointment for the
 * caller who asks: given to who may book on the calendar, as the command asks it (a patient for
 * themselves, the staff of the calendar for anybody), refused with 403 to anybody else.
 */
const form = defineForm<BookAppointmentBody>({
  requires: {
    permission: schedulingPermissions['appointment.book'],
    subject: (values) => (values.calendarId === undefined ? undefined : { type: 'calendar', id: values.calendarId }),
    context: (values, actor) => ({ selfService: (values.patientId ?? actor.id) === actor.id }),
  },
  groups: [{ name: 'when', fields: ['calendarId', 'appointmentTypeId', 'startsAt'] }],
  fields: {
    appointmentTypeId: { lookup: 'getCalendarDay' },
    startsAt: { widget: 'datetime' },
    internalNote: { widget: 'textarea' },
  },
});

@Controller({
  group: AppointmentsRoutes,
  method: 'POST',
  path: '/',
  summary: 'Book appointment',
  form,
  consumes: ['application/xml'],
  produces: ['application/xml'],
  body,
  response: { status: 201, description: 'Done; the body carries the identifier.', body: accepted },
  errors: [
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
export class BookAppointmentController {
  constructor(
    private readonly commands: CommandBus,
    private readonly mapper: BookAppointmentMapper,
  ) {}

  async handle(request: HttpRequest<{ body: BookAppointmentBody }>): Promise<BookAppointmentAccepted> {
    const id = await this.commands.execute(this.mapper.map(request));

    return { id };
  }
}
