import { Controller, type HttpRequest } from '@ddd-ts-kit/http';
import type { CommandBus } from '@ddd-ts-kit/kernel';
import { classSchema } from '@ddd-ts-kit/validation/class-validator';
import { RevokeDelegationCommand } from '@/contexts/identity/application/commands/revoke-delegation/revoke-delegation.command';
import { RevokeDelegationParams } from '@/contexts/identity/presentation/http/practices/revoke-delegation/revoke-delegation.params';
import { RevokeDelegationAccepted } from '@/contexts/identity/presentation/http/practices/revoke-delegation/revoke-delegation.accepted';
import { PracticesRoutes } from '@/contexts/identity/presentation/http/practices.routes';

const params = classSchema(RevokeDelegationParams);
const accepted = classSchema(RevokeDelegationAccepted);

@Controller({
  group: PracticesRoutes,
  method: 'DELETE',
  path: '/:practiceId/desks/:practitionerId/delegations/:delegationId',
  summary: 'Revoke delegation',
  params,
  response: { status: 200, description: 'Done; the body carries the identifier.', body: accepted },
  errors: ['DELEGATION_NOT_FOUND', 'DELEGATION_NOT_ACTIVE'],
})
export class RevokeDelegationController {
  constructor(private readonly commands: CommandBus) {}

  async handle(request: HttpRequest<{ params: RevokeDelegationParams }>): Promise<RevokeDelegationAccepted> {
    const id = await this.commands.execute(
      new RevokeDelegationCommand(request.actor, request.params, request.params.delegationId),
    );

    return { id };
  }
}
