{{#if validation.classValidator}}
{{#if schemas.shared}}
import { acceptedSchema, Controller, type Accepted, type HttpRequest } from '@ddd-ts-kit/http';
{{/if}}
{{#if schemas.perRoute}}
import { Controller, type HttpRequest } from '@ddd-ts-kit/http';
{{/if}}
import type { CommandBus } from '@ddd-ts-kit/kernel';
{{#if schemas.perRoute}}
import { classSchema } from '@ddd-ts-kit/validation/class-validator';
{{/if}}
import { DeactivateAccountCommand } from '{{alias.context}}/application/commands/deactivate-account/deactivate-account.command{{alias.ext}}';
{{#if schemas.perRoute}}
import { DeactivateAccountAccepted } from '{{alias.context}}/presentation/http/accounts/deactivate-account/deactivate-account.accepted{{alias.ext}}';
{{/if}}
import { AccountsRoutes } from '{{alias.context}}/presentation/http/accounts.routes{{alias.ext}}';
{{/if}}
{{#if validation.zod}}
{{#if schemas.perRoute}}
import { z } from 'zod';
{{/if}}
{{#if schemas.shared}}
import { acceptedSchema, Controller, type Accepted, type HttpRequest } from '@ddd-ts-kit/http';
{{/if}}
{{#if schemas.perRoute}}
import { Controller, type HttpRequest } from '@ddd-ts-kit/http';
{{/if}}
import type { CommandBus } from '@ddd-ts-kit/kernel';
{{#if schemas.perRoute}}
import type { Infer } from '@ddd-ts-kit/validation';
{{/if}}
{{#if schemas.perRoute}}
import { zodSchema } from '@ddd-ts-kit/validation/zod';
{{/if}}
import { DeactivateAccountCommand } from '{{alias.context}}/application/commands/deactivate-account/deactivate-account.command{{alias.ext}}';
import { AccountsRoutes } from '{{alias.context}}/presentation/http/accounts.routes{{alias.ext}}';
{{/if}}

{{#if validation.classValidator}}
{{#if schemas.perRoute}}
const accepted = classSchema(DeactivateAccountAccepted);
{{/if}}
{{/if}}
{{#if validation.zod}}
{{#if schemas.perRoute}}
const accepted = zodSchema(z.object({ id: z.string() }), { io: 'output' });
{{/if}}
{{/if}}

@Controller({
  group: AccountsRoutes,
  method: 'POST',
  path: '/me/deactivation',
  summary: 'Deactivate my account',
  response: { status: 200, description: 'The account is deactivated; the body carries its identifier.', body: {{#if schemas.shared}}acceptedSchema{{/if}}{{#if schemas.perRoute}}accepted{{/if}} },
  errors: ['ACCOUNT_NOT_FOUND', 'ACCOUNT_ALREADY_DEACTIVATED', 'ORGANISATION_NOT_FOUND', 'LAST_OWNER'],
})
export class DeactivateAccountController {
  constructor(private readonly commands: CommandBus) {}

{{#if validation.classValidator}}
  async handle(request: HttpRequest<object>): Promise<{{#if schemas.shared}}Accepted{{/if}}{{#if schemas.perRoute}}DeactivateAccountAccepted{{/if}}> {
{{/if}}
{{#if validation.zod}}
  async handle(request: HttpRequest<object>): Promise<{{#if schemas.shared}}Accepted{{/if}}{{#if schemas.perRoute}}Infer<typeof accepted>{{/if}}> {
{{/if}}
    const id = await this.commands.execute(new DeactivateAccountCommand(request.actor));

    return { id };
  }
}
