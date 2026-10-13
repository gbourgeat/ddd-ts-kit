{{#if validation.classValidator}}
import { Controller, type HttpRequest } from '@ddd-ts-kit/http';
import type { CommandBus } from '@ddd-ts-kit/kernel';
import { classSchema } from '@ddd-ts-kit/validation/class-validator';
import { DeactivateAccountCommand } from '{{alias.context}}/application/commands/deactivate-account/deactivate-account.command{{alias.ext}}';
import { DeactivateAccountAccepted } from '{{alias.context}}/presentation/http/accounts/deactivate-account/deactivate-account.accepted{{alias.ext}}';
import { AccountsRoutes } from '{{alias.context}}/presentation/http/accounts.routes{{alias.ext}}';
{{/if}}
{{#if validation.zod}}
import { z } from 'zod';
import { Controller, type HttpRequest } from '@ddd-ts-kit/http';
import type { CommandBus } from '@ddd-ts-kit/kernel';
import type { Infer } from '@ddd-ts-kit/validation';
import { zodSchema } from '@ddd-ts-kit/validation/zod';
import { DeactivateAccountCommand } from '{{alias.context}}/application/commands/deactivate-account/deactivate-account.command{{alias.ext}}';
import { AccountsRoutes } from '{{alias.context}}/presentation/http/accounts.routes{{alias.ext}}';
{{/if}}

{{#if validation.classValidator}}
const accepted = classSchema(DeactivateAccountAccepted);
{{/if}}
{{#if validation.zod}}
const accepted = zodSchema(z.object({ id: z.string() }), { io: 'output' });
{{/if}}

@Controller({
  group: AccountsRoutes,
  method: 'POST',
  path: '/me/deactivation',
  summary: 'Deactivate my account',
  response: { status: 200, description: 'The account is deactivated; the body carries its identifier.', body: accepted },
  errors: ['ACCOUNT_NOT_FOUND', 'ACCOUNT_ALREADY_DEACTIVATED', 'ORGANISATION_NOT_FOUND', 'LAST_OWNER'],
})
export class DeactivateAccountController {
  constructor(private readonly commands: CommandBus) {}

{{#if validation.classValidator}}
  async handle(request: HttpRequest<object>): Promise<DeactivateAccountAccepted> {
{{/if}}
{{#if validation.zod}}
  async handle(request: HttpRequest<object>): Promise<Infer<typeof accepted>> {
{{/if}}
    const id = await this.commands.execute(new DeactivateAccountCommand(request.actor));

    return { id };
  }
}
