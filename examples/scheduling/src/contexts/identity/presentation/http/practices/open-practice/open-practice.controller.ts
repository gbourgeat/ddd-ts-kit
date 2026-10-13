import { acceptedSchema, Controller, type Accepted, type HttpRequest } from '@ddd-ts-kit/http';
import type { CommandBus } from '@ddd-ts-kit/kernel';
import { classSchema } from '@ddd-ts-kit/validation/class-validator';
import { OpenPracticeCommand } from '@/contexts/identity/application/commands/open-practice/open-practice.command';
import { OpenPracticeBody } from '@/contexts/identity/presentation/http/practices/open-practice/open-practice.body';
import { PracticeOpeningRoutes } from '@/contexts/identity/presentation/http/practice-opening.routes';

const body = classSchema(OpenPracticeBody);

@Controller({
  group: PracticeOpeningRoutes,
  method: 'POST',
  path: '/',
  summary: 'Open practice',
  body,
  response: { status: 201, description: 'Done; the body carries the identifier.', body: acceptedSchema },
  errors: ['UNKNOWN_TIME_ZONE', 'PERSON_NOT_REGISTERED'],
})
export class OpenPracticeController {
  constructor(private readonly commands: CommandBus) {}

  async handle(request: HttpRequest<{ body: OpenPracticeBody }>): Promise<Accepted> {
    const id = await this.commands.execute(
      new OpenPracticeCommand(request.actor, {
        name: request.body.name,
        timeZone: request.body.timeZone,
        managerId: request.body.managerId,
      }),
    );

    return { id };
  }
}
