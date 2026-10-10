import { actorOf } from '@ddd-ts-kit/auth';
import { defineRoute, type Route } from '@ddd-ts-kit/http';
import type { CommandBus } from '@ddd-ts-kit/kernel';
import { classSchema } from '@ddd-ts-kit/validation/class-validator';
import { AddExceptionCommand } from '../../application/commands/add-exception/add-exception.command.js';
import { AddExceptionParams } from './add-exception-params.dto.js';
import { AddExceptionBody } from './add-exception-body.dto.js';
import { AddExceptionAccepted } from './add-exception-accepted.dto.js';

const params = classSchema(AddExceptionParams);
const body = classSchema(AddExceptionBody);
const accepted = classSchema(AddExceptionAccepted);

export function addExceptionRoute(commands: CommandBus): Route {
  return defineRoute(
    {
      method: 'POST',
      path: '/calendars/:calendarId/exceptions',
      operationId: 'addException',
      summary: 'Add exception',
      tags: ['scheduling'],
      request: { params, body },
      responses: { 201: { description: 'Done; the body carries the identifier.', body: accepted } },
      errors: ['UNAUTHORIZED', 'FORBIDDEN', 'UNKNOWN_CALENDAR', 'INVALID_DAY', 'INVALID_RANGE'],
      security: ['bearer'],
    },
    async (input) => {
      const { day, ranges } = input.body;
      const id = await commands.execute(new AddExceptionCommand(actorOf(input.context.principal), input.params.calendarId, day, ranges));

      return { status: 201, body: { id } };
    },
  );
}
