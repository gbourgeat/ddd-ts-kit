import { acceptedSchema, Controller, type Accepted, type HttpRequest } from '@ddd-ts-kit/http';
import type { CommandBus } from '@ddd-ts-kit/kernel';
import { classSchema } from '@ddd-ts-kit/validation/class-validator';
import { RemoveMemberCommand } from '@/contexts/identity/application/commands/remove-member/remove-member.command';
import { RemoveMemberParams } from '@/contexts/identity/presentation/http/practices/remove-member/remove-member.params';
import { PracticesRoutes } from '@/contexts/identity/presentation/http/practices.routes';

const params = classSchema(RemoveMemberParams);

@Controller({
  group: PracticesRoutes,
  method: 'DELETE',
  path: '/:practiceId/members/:personId',
  summary: 'Remove member',
  params,
  response: { status: 200, description: 'Done; the body carries the identifier.', body: acceptedSchema },
  errors: ['PRACTICE_NOT_FOUND', 'NOT_A_MEMBER', 'LAST_MANAGER'],
})
export class RemoveMemberController {
  constructor(private readonly commands: CommandBus) {}

  async handle(request: HttpRequest<{ params: RemoveMemberParams }>): Promise<Accepted> {
    const id = await this.commands.execute(
      new RemoveMemberCommand(request.actor, request.params.practiceId, request.params.personId),
    );

    return { id };
  }
}
