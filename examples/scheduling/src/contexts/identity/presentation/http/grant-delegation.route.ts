import { actorOf } from '@ddd-ts-kit/auth';
import { defineRoute, type Route } from '@ddd-ts-kit/http';
import type { CommandBus } from '@ddd-ts-kit/kernel';
import { classSchema } from '@ddd-ts-kit/validation/class-validator';
import { GrantDelegationCommand } from '../../application/commands/grant-delegation/grant-delegation.command.js';
import { GrantDelegationParams } from './grant-delegation-params.dto.js';
import { GrantDelegationBody } from './grant-delegation-body.dto.js';
import { GrantDelegationAccepted } from './grant-delegation-accepted.dto.js';

const params = classSchema(GrantDelegationParams);
const body = classSchema(GrantDelegationBody);
const accepted = classSchema(GrantDelegationAccepted);

export function grantDelegationRoute(commands: CommandBus): Route {
  return defineRoute(
    {
      method: 'POST',
      path: '/practices/:practiceId/desks/:practitionerId/delegations',
      operationId: 'grantDelegation',
      summary: 'Grant delegation',
      tags: ['identity'],
      request: { params, body },
      responses: { 201: { description: 'Done; the body carries the identifier.', body: accepted } },
      errors: [
        'UNAUTHORIZED',
        'FORBIDDEN',
        'PRACTICE_NOT_FOUND',
        'NOT_A_PRACTITIONER',
        'NOT_AN_ASSISTANT',
        'DELEGATION_ENDS_IN_THE_PAST',
        'DELEGATION_ALREADY_ACTIVE',
      ],
      security: ['bearer'],
    },
    async (input) => {
      const { assistantId, availabilityIncluded, endsAt } = input.body;
      const terms = { assistantId, availabilityIncluded, ...(endsAt === undefined ? {} : { endsAt: new Date(endsAt) }) };
      const id = await commands.execute(new GrantDelegationCommand(actorOf(input.context.principal), input.params, terms));

      return { status: 201, body: { id } };
    },
  );
}
