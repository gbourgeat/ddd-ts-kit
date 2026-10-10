import { actorOf } from '@ddd-ts-kit/auth';
import { defineRoute, type Route } from '@ddd-ts-kit/http';
import type { CommandBus } from '@ddd-ts-kit/kernel';
import { classSchema } from '@ddd-ts-kit/validation/class-validator';
import { SetOpeningHoursCommand } from '../../application/commands/set-opening-hours/set-opening-hours.command.js';
import { SetOpeningHoursParams } from './set-opening-hours-params.dto.js';
import { SetOpeningHoursBody } from './set-opening-hours-body.dto.js';
import { SetOpeningHoursAccepted } from './set-opening-hours-accepted.dto.js';

const params = classSchema(SetOpeningHoursParams);
const body = classSchema(SetOpeningHoursBody);
const accepted = classSchema(SetOpeningHoursAccepted);

export function setOpeningHoursRoute(commands: CommandBus): Route {
  return defineRoute(
    {
      method: 'PUT',
      path: '/calendars/:calendarId/opening-hours',
      operationId: 'setOpeningHours',
      summary: 'Set opening hours',
      tags: ['scheduling'],
      request: { params, body },
      responses: { 200: { description: 'Done; the body carries the identifier.', body: accepted } },
      errors: ['UNAUTHORIZED', 'FORBIDDEN', 'UNKNOWN_CALENDAR', 'INVALID_RANGE'],
      security: ['bearer'],
    },
    async (input) => {
      const id = await commands.execute(
        new SetOpeningHoursCommand(actorOf(input.context.principal), input.params.calendarId, input.body.ranges),
      );

      return { status: 200, body: { id } };
    },
  );
}
