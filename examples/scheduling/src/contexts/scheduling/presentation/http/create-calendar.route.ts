import { actorOf } from '@ddd-ts-kit/auth';
import { defineRoute, type Route } from '@ddd-ts-kit/http';
import type { CommandBus } from '@ddd-ts-kit/kernel';
import { classSchema } from '@ddd-ts-kit/validation/class-validator';
import { CreateCalendarCommand } from '#src/contexts/scheduling/application/commands/create-calendar/create-calendar.command.js';
import { CreateCalendarBody } from '#src/contexts/scheduling/presentation/http/create-calendar-body.dto.js';
import { CreateCalendarAccepted } from '#src/contexts/scheduling/presentation/http/create-calendar-accepted.dto.js';

const body = classSchema(CreateCalendarBody);
const accepted = classSchema(CreateCalendarAccepted);

export function createCalendarRoute(commands: CommandBus): Route {
  return defineRoute(
    {
      method: 'POST',
      path: '/calendars',
      operationId: 'createCalendar',
      summary: 'Create calendar',
      tags: ['scheduling'],
      request: { body },
      responses: { 201: { description: 'Done; the body carries the identifier.', body: accepted } },
      errors: ['UNAUTHORIZED', 'FORBIDDEN', 'UNKNOWN_PRACTITIONER', 'UNKNOWN_TIME_ZONE'],
      security: ['bearer'],
    },
    async (input) => {
      const { practiceId, practitionerId } = input.body;

      const id = await commands.execute(
        new CreateCalendarCommand(actorOf(input.context.principal), practiceId, practitionerId),
      );

      return { status: 201, body: { id } };
    },
  );
}
