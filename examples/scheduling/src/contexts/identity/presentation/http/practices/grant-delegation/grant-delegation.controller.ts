import { acceptedSchema, Controller, type Accepted, type HttpRequest } from '@ddd-ts-kit/http';
import type { CommandBus } from '@ddd-ts-kit/kernel';
import { classSchema } from '@ddd-ts-kit/validation/class-validator';
import { GrantDelegationCommand } from '@/contexts/identity/application/commands/grant-delegation/grant-delegation.command';
import { GrantDelegationParams } from '@/contexts/identity/presentation/http/practices/grant-delegation/grant-delegation.params';
import { GrantDelegationBody } from '@/contexts/identity/presentation/http/practices/grant-delegation/grant-delegation.body';
import { PracticesRoutes } from '@/contexts/identity/presentation/http/practices.routes';

const params = classSchema(GrantDelegationParams);
const body = classSchema(GrantDelegationBody);

@Controller({
  group: PracticesRoutes,
  method: 'POST',
  path: '/:practiceId/desks/:practitionerId/delegations',
  summary: 'Grant delegation',
  params,
  body,
  response: { status: 201, description: 'Done; the body carries the identifier.', body: acceptedSchema },
  errors: [
    'PRACTICE_NOT_FOUND',
    'NOT_A_PRACTITIONER',
    'NOT_AN_ASSISTANT',
    'DELEGATION_ENDS_IN_THE_PAST',
    'DELEGATION_ALREADY_ACTIVE',
  ],
})
export class GrantDelegationController {
  constructor(private readonly commands: CommandBus) {}

  async handle(request: HttpRequest<{ params: GrantDelegationParams; body: GrantDelegationBody }>): Promise<Accepted> {
    const id = await this.commands.execute(
      new GrantDelegationCommand(request.actor, request.params, termsOf(request.body)),
    );

    return { id };
  }
}

function termsOf({ assistantId, availabilityIncluded, endsAt }: GrantDelegationBody): GrantDelegationCommand['terms'] {
  return {
    assistantId,
    availabilityIncluded,
    ...(endsAt === undefined ? {} : { endsAt: new Date(endsAt) }),
  };
}
