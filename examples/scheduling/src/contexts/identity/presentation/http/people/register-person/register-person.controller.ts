import { Controller, type HttpRequest } from '@ddd-ts-kit/http';
import type { CommandBus } from '@ddd-ts-kit/kernel';
import { classSchema } from '@ddd-ts-kit/validation/class-validator';
import { RegisterPersonCommand } from '@/contexts/identity/application/commands/register-person/register-person.command';
import { RegisterPersonBody } from '@/contexts/identity/presentation/http/people/register-person/register-person.body';
import { RegisterPersonAccepted } from '@/contexts/identity/presentation/http/people/register-person/register-person.accepted';
import { PeopleRoutes } from '@/contexts/identity/presentation/http/people.routes';

const body = classSchema(RegisterPersonBody);
const accepted = classSchema(RegisterPersonAccepted);

@Controller({
  group: PeopleRoutes,
  method: 'PUT',
  path: '/me',
  summary: 'Register person',
  body,
  response: { status: 200, description: 'Done; the body carries the identifier.', body: accepted },
  errors: ['INVALID_DISPLAY_NAME', 'INVALID_EMAIL'],
})
export class RegisterPersonController {
  constructor(private readonly commands: CommandBus) {}

  async handle(request: HttpRequest<{ body: RegisterPersonBody }>): Promise<RegisterPersonAccepted> {
    const id = await this.commands.execute(
      new RegisterPersonCommand(request.actor, request.body.displayName, request.body.email),
    );

    return { id };
  }
}
