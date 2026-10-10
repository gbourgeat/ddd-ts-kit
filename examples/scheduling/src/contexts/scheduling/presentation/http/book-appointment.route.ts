import { actorOf } from '@ddd-ts-kit/auth';
import { defineRoute, type Route } from '@ddd-ts-kit/http';
import type { Actor, CommandBus } from '@ddd-ts-kit/kernel';
import { classSchema } from '@ddd-ts-kit/validation/class-validator';
import { BookAppointmentCommand } from '@/contexts/scheduling/application/commands/book-appointment/book-appointment.command.js';
import { BookAppointmentBody } from '@/contexts/scheduling/presentation/http/book-appointment-body.dto.js';
import { BookAppointmentAccepted } from '@/contexts/scheduling/presentation/http/book-appointment-accepted.dto.js';

const body = classSchema(BookAppointmentBody);
const accepted = classSchema(BookAppointmentAccepted);

export function bookAppointmentRoute(commands: CommandBus): Route {
  return defineRoute(
    {
      method: 'POST',
      path: '/appointments',
      operationId: 'bookAppointment',
      summary: 'Book appointment',
      tags: ['scheduling'],
      request: { body },
      responses: { 201: { description: 'Done; the body carries the identifier.', body: accepted } },
      errors: [
        'UNAUTHORIZED',
        'FORBIDDEN',
        'UNKNOWN_CALENDAR',
        'UNKNOWN_APPOINTMENT_TYPE',
        'OUTSIDE_AVAILABILITY',
        'OFF_GRID',
        'BOOKING_TOO_LATE',
        'BOOKING_TOO_FAR',
        'SLOT_TAKEN',
        'PATIENT_LIMIT_REACHED',
      ],
      security: ['bearer'],
    },
    async (input) => {
      const id = await commands.execute(bookingOf(actorOf(input.context.principal), input.body));

      return { status: 201, body: { id } };
    },
  );
}

function bookingOf(actor: Actor, body: BookAppointmentBody): BookAppointmentCommand {
  const { calendarId, appointmentTypeId, startsAt, patientId } = body;
  // Without a patient named, the caller books for themselves.
  const wish = { patientId: patientId ?? actor.id, appointmentTypeId, startsAt: new Date(startsAt) };

  return new BookAppointmentCommand(actor, calendarId, wish);
}
