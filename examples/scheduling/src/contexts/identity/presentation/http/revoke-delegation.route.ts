import { actorOf } from '@ddd-ts-kit/auth';
import { defineRoute, type Route } from '@ddd-ts-kit/http';
import type { CommandBus } from '@ddd-ts-kit/kernel';
import { classSchema } from '@ddd-ts-kit/validation/class-validator';
import { RevokeDelegationCommand } from '../../application/commands/revoke-delegation/revoke-delegation.command.js';
import { RevokeDelegationParams } from './revoke-delegation-params.dto.js';
import { RevokeDelegationAccepted } from './revoke-delegation-accepted.dto.js';

const params = classSchema(RevokeDelegationParams);
const accepted = classSchema(RevokeDelegationAccepted);

export function revokeDelegationRoute(commands: CommandBus): Route {
  return defineRoute(
    {
      method: 'DELETE',
      path: '/practices/:practiceId/desks/:practitionerId/delegations/:delegationId',
      operationId: 'revokeDelegation',
      summary: 'Revoke delegation',
      tags: ['identity'],
      request: { params },
      responses: { 200: { description: 'Done; the body carries the identifier.', body: accepted } },
      errors: ['UNAUTHORIZED', 'FORBIDDEN', 'DELEGATION_NOT_FOUND', 'DELEGATION_NOT_ACTIVE'],
      security: ['bearer'],
    },
    async (input) => {
      const id = await commands.execute(new RevokeDelegationCommand(actorOf(input.context.principal), input.params, input.params.delegationId));

      return { status: 200, body: { id } };
    },
  );
}
