import { Controller, type HttpRequest } from '@ddd-ts-kit/http';
import type { CommandBus } from '@ddd-ts-kit/kernel';
import { classSchema } from '@ddd-ts-kit/validation/class-validator';
import { BookAppointmentBody } from '@/contexts/scheduling/presentation/http/appointments/book-appointment/book-appointment.body';
import { BookAppointmentAccepted } from '@/contexts/scheduling/presentation/http/appointments/book-appointment/book-appointment.accepted';
import type { BookAppointmentMapper } from '@/contexts/scheduling/presentation/http/appointments/book-appointment/book-appointment.mapper';
import { AppointmentsRoutes } from '@/contexts/scheduling/presentation/http/appointments.routes';

const body = classSchema(BookAppointmentBody);
const accepted = classSchema(BookAppointmentAccepted);

@Controller({
  group: AppointmentsRoutes,
  method: 'POST',
  path: '/',
  summary: 'Book appointment',
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
