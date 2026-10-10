import { actorOf } from '@ddd-ts-kit/auth';
import { defineRoute, type Route } from '@ddd-ts-kit/http';
import type { CommandBus } from '@ddd-ts-kit/kernel';
import { classSchema } from '@ddd-ts-kit/validation/class-validator';
import { AddMemberCommand } from '../../application/commands/add-member/add-member.command.js';
import { AddMemberParams } from './add-member-params.dto.js';
import { AddMemberBody } from './add-member-body.dto.js';
import { AddMemberAccepted } from './add-member-accepted.dto.js';

const params = classSchema(AddMemberParams);
const body = classSchema(AddMemberBody);
const accepted = classSchema(AddMemberAccepted);

export function addMemberRoute(commands: CommandBus): Route {
  return defineRoute(
    {
      method: 'POST',
      path: '/practices/:practiceId/members',
      operationId: 'addMember',
      summary: 'Add member',
      tags: ['identity'],
      request: { params, body },
      responses: { 201: { description: 'Done; the body carries the identifier.', body: accepted } },
      errors: [
        'UNAUTHORIZED',
        'FORBIDDEN',
        'PRACTICE_NOT_FOUND',
        'PERSON_NOT_REGISTERED',
        'UNKNOWN_ROLE',
        'ALREADY_MEMBER',
      ],
      security: ['bearer'],
    },
    async (input) => {
      const id = await commands.execute(
        new AddMemberCommand(actorOf(input.context.principal), input.params.practiceId, {
          personId: input.body.personId,
          role: input.body.role,
        }),
      );

      return { status: 201, body: { id } };
    },
  );
}
