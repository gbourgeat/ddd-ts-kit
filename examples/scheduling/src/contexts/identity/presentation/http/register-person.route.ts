import { actorOf } from '@ddd-ts-kit/auth';
import { defineRoute, type Route } from '@ddd-ts-kit/http';
import type { CommandBus } from '@ddd-ts-kit/kernel';
import { classSchema } from '@ddd-ts-kit/validation/class-validator';
import { RegisterPersonCommand } from '../../application/commands/register-person/register-person.command.js';
import { RegisterPersonBody } from './register-person-body.dto.js';
import { RegisterPersonAccepted } from './register-person-accepted.dto.js';

const body = classSchema(RegisterPersonBody);
const accepted = classSchema(RegisterPersonAccepted);

export function registerPersonRoute(commands: CommandBus): Route {
  return defineRoute(
    {
      method: 'PUT',
      path: '/people/me',
      operationId: 'registerPerson',
      summary: 'Register person',
      tags: ['identity'],
      request: { body },
      responses: { 200: { description: 'Done; the body carries the identifier.', body: accepted } },
      errors: ['UNAUTHORIZED', 'FORBIDDEN', 'INVALID_DISPLAY_NAME', 'INVALID_EMAIL'],
      security: ['bearer'],
    },
    async (input) => {
      const id = await commands.execute(new RegisterPersonCommand(actorOf(input.context.principal), input.body.displayName, input.body.email));

      return { status: 200, body: { id } };
    },
  );
}
