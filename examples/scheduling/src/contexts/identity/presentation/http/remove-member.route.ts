import { actorOf } from '@ddd-ts-kit/auth';
import { defineRoute, type Route } from '@ddd-ts-kit/http';
import type { CommandBus } from '@ddd-ts-kit/kernel';
import { classSchema } from '@ddd-ts-kit/validation/class-validator';
import { RemoveMemberCommand } from '../../application/commands/remove-member/remove-member.command.js';
import { RemoveMemberParams } from './remove-member-params.dto.js';
import { RemoveMemberAccepted } from './remove-member-accepted.dto.js';

const params = classSchema(RemoveMemberParams);
const accepted = classSchema(RemoveMemberAccepted);

export function removeMemberRoute(commands: CommandBus): Route {
  return defineRoute(
    {
      method: 'DELETE',
      path: '/practices/:practiceId/members/:personId',
      operationId: 'removeMember',
      summary: 'Remove member',
      tags: ['identity'],
      request: { params },
      responses: { 200: { description: 'Done; the body carries the identifier.', body: accepted } },
      errors: ['UNAUTHORIZED', 'FORBIDDEN', 'PRACTICE_NOT_FOUND', 'NOT_A_MEMBER', 'LAST_MANAGER'],
      security: ['bearer'],
    },
    async (input) => {
      const id = await commands.execute(
        new RemoveMemberCommand(actorOf(input.context.principal), input.params.practiceId, input.params.personId),
      );

      return { status: 200, body: { id } };
    },
  );
}
