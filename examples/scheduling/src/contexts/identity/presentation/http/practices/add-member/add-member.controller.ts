import { acceptedSchema, Controller, type Accepted, type HttpRequest } from '@ddd-ts-kit/http';
import type { CommandBus } from '@ddd-ts-kit/kernel';
import { classSchema } from '@ddd-ts-kit/validation/class-validator';
import { AddMemberCommand } from '@/contexts/identity/application/commands/add-member/add-member.command';
import { AddMemberParams } from '@/contexts/identity/presentation/http/practices/add-member/add-member.params';
import { AddMemberBody } from '@/contexts/identity/presentation/http/practices/add-member/add-member.body';
import { PracticesRoutes } from '@/contexts/identity/presentation/http/practices.routes';

const params = classSchema(AddMemberParams);
const body = classSchema(AddMemberBody);

@Controller({
  group: PracticesRoutes,
  method: 'POST',
  path: '/:practiceId/members',
  summary: 'Add member',
  params,
  body,
  response: { status: 201, description: 'Done; the body carries the identifier.', body: acceptedSchema },
  errors: ['PRACTICE_NOT_FOUND', 'PERSON_NOT_REGISTERED', 'UNKNOWN_ROLE', 'ALREADY_MEMBER'],
})
export class AddMemberController {
  constructor(private readonly commands: CommandBus) {}

  async handle(request: HttpRequest<{ params: AddMemberParams; body: AddMemberBody }>): Promise<Accepted> {
    const id = await this.commands.execute(
      new AddMemberCommand(request.actor, request.params.practiceId, {
        personId: request.body.personId,
        role: request.body.role,
      }),
    );

    return { id };
  }
}
