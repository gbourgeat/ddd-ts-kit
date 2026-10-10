import { actorOf } from '@ddd-ts-kit/auth';
import { defineRoute, type Route } from '@ddd-ts-kit/http';
import type { CommandBus } from '@ddd-ts-kit/kernel';
import { classSchema } from '@ddd-ts-kit/validation/class-validator';
import { AddTimeOffCommand } from '@/contexts/scheduling/application/commands/add-time-off/add-time-off.command.js';
import { AddTimeOffParams } from '@/contexts/scheduling/presentation/http/add-time-off-params.dto.js';
import { AddTimeOffBody } from '@/contexts/scheduling/presentation/http/add-time-off-body.dto.js';
import { AddTimeOffAccepted } from '@/contexts/scheduling/presentation/http/add-time-off-accepted.dto.js';

const params = classSchema(AddTimeOffParams);
const body = classSchema(AddTimeOffBody);
const accepted = classSchema(AddTimeOffAccepted);

export function addTimeOffRoute(commands: CommandBus): Route {
  return defineRoute(
    {
      method: 'POST',
      path: '/calendars/:calendarId/time-off',
      operationId: 'addTimeOff',
      summary: 'Add time off',
      tags: ['scheduling'],
      request: { params, body },
      responses: { 201: { description: 'Done; the body carries the identifier.', body: accepted } },
      errors: ['UNAUTHORIZED', 'FORBIDDEN', 'UNKNOWN_CALENDAR', 'INVALID_TIME_OFF', 'TIME_OFF_OVER_APPOINTMENTS'],
      security: ['bearer'],
    },
    async (input) => {
      const { startsAt, endsAt } = input.body;

      const id = await commands.execute(
        new AddTimeOffCommand(
          actorOf(input.context.principal),
          input.params.calendarId,
          new Date(startsAt),
          new Date(endsAt),
        ),
      );

      return { status: 201, body: { id } };
    },
  );
}
