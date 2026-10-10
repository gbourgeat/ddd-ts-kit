import { actorOf } from '@ddd-ts-kit/auth';
import { defineRoute, type Route } from '@ddd-ts-kit/http';
import type { CommandBus } from '@ddd-ts-kit/kernel';
import { classSchema } from '@ddd-ts-kit/validation/class-validator';
import { JoinWaitlistCommand } from '@/contexts/scheduling/application/commands/join-waitlist/join-waitlist.command.js';
import { JoinWaitlistParams } from '@/contexts/scheduling/presentation/http/join-waitlist-params.dto.js';
import { JoinWaitlistBody } from '@/contexts/scheduling/presentation/http/join-waitlist-body.dto.js';
import { JoinWaitlistAccepted } from '@/contexts/scheduling/presentation/http/join-waitlist-accepted.dto.js';

const params = classSchema(JoinWaitlistParams);
const body = classSchema(JoinWaitlistBody);
const accepted = classSchema(JoinWaitlistAccepted);

export function joinWaitlistRoute(commands: CommandBus): Route {
  return defineRoute(
    {
      method: 'POST',
      path: '/calendars/:calendarId/waitlist',
      operationId: 'joinWaitlist',
      summary: 'Join waitlist',
      tags: ['scheduling'],
      request: { params, body },
      responses: { 201: { description: 'Done; the body carries the identifier.', body: accepted } },
      errors: [
        'UNAUTHORIZED',
        'FORBIDDEN',
        'UNKNOWN_CALENDAR',
        'UNKNOWN_APPOINTMENT_TYPE',
        'INVALID_DAY',
        'ALREADY_WAITING',
      ],
      security: ['bearer'],
    },
    async (input) => {
      const id = await commands.execute(
        new JoinWaitlistCommand(actorOf(input.context.principal), input.params.calendarId, waitOf(input.body)),
      );

      return { status: 201, body: { id } };
    },
  );
}

function waitOf({ patientId, appointmentTypeId, day }: JoinWaitlistBody): JoinWaitlistCommand['wait'] {
  return { patientId, appointmentTypeId, day };
}
