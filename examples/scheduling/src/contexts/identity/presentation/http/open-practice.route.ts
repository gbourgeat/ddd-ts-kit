import { actorOf } from '@ddd-ts-kit/auth';
import { defineRoute, type Route } from '@ddd-ts-kit/http';
import type { CommandBus } from '@ddd-ts-kit/kernel';
import { classSchema } from '@ddd-ts-kit/validation/class-validator';
import { OpenPracticeCommand } from '@/contexts/identity/application/commands/open-practice/open-practice.command.js';
import { OpenPracticeBody } from '@/contexts/identity/presentation/http/open-practice-body.dto.js';
import { OpenPracticeAccepted } from '@/contexts/identity/presentation/http/open-practice-accepted.dto.js';

const body = classSchema(OpenPracticeBody);
const accepted = classSchema(OpenPracticeAccepted);

export function openPracticeRoute(commands: CommandBus): Route {
  return defineRoute(
    {
      method: 'POST',
      path: '/practices',
      operationId: 'openPractice',
      summary: 'Open practice',
      tags: ['identity'],
      request: { body },
      responses: { 201: { description: 'Done; the body carries the identifier.', body: accepted } },
      errors: ['UNAUTHORIZED', 'FORBIDDEN', 'UNKNOWN_TIME_ZONE', 'PERSON_NOT_REGISTERED'],
      security: ['bearer'],
    },
    async (input) => {
      const id = await commands.execute(
        new OpenPracticeCommand(actorOf(input.context.principal), {
          name: input.body.name,
          timeZone: input.body.timeZone,
          managerId: input.body.managerId,
        }),
      );

      return { status: 201, body: { id } };
    },
  );
}
