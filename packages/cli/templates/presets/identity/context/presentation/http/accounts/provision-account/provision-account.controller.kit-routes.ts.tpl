{{#if validation.classValidator}}
{{#if schemas.shared}}
import { acceptedSchema, Controller, type Accepted, type HttpRequest } from '@ddd-ts-kit/http';
{{/if}}
{{#if schemas.perRoute}}
import { Controller, type HttpRequest } from '@ddd-ts-kit/http';
{{/if}}
import type { Actor, CommandBus } from '@ddd-ts-kit/kernel';
import { classSchema } from '@ddd-ts-kit/validation/class-validator';
import { ProvisionAccountCommand } from '{{alias.context}}/application/commands/provision-account/provision-account.command{{alias.ext}}';
import { ProvisionAccountBody } from '{{alias.context}}/presentation/http/accounts/provision-account/provision-account.body{{alias.ext}}';
{{#if schemas.perRoute}}
import { ProvisionAccountAccepted } from '{{alias.context}}/presentation/http/accounts/provision-account/provision-account.accepted{{alias.ext}}';
{{/if}}
import { AccountsRoutes } from '{{alias.context}}/presentation/http/accounts.routes{{alias.ext}}';
{{/if}}
{{#if validation.zod}}
import { z } from 'zod';
{{#if schemas.shared}}
import { acceptedSchema, Controller, type Accepted, type HttpRequest } from '@ddd-ts-kit/http';
{{/if}}
{{#if schemas.perRoute}}
import { Controller, type HttpRequest } from '@ddd-ts-kit/http';
{{/if}}
import type { Actor, CommandBus } from '@ddd-ts-kit/kernel';
import type { Infer } from '@ddd-ts-kit/validation';
import { zodSchema } from '@ddd-ts-kit/validation/zod';
import { ProvisionAccountCommand } from '{{alias.context}}/application/commands/provision-account/provision-account.command{{alias.ext}}';
import { AccountsRoutes } from '{{alias.context}}/presentation/http/accounts.routes{{alias.ext}}';
{{/if}}

{{#if validation.classValidator}}
const body = classSchema(ProvisionAccountBody);
{{#if schemas.perRoute}}
const accepted = classSchema(ProvisionAccountAccepted);
{{/if}}
{{/if}}
{{#if validation.zod}}
const body = zodSchema(
  z.object({
    displayName: z.string().min(1).optional(),
  }),
);

{{#if schemas.perRoute}}
const accepted = zodSchema(z.object({ id: z.string() }), { io: 'output' });
{{/if}}
{{/if}}

@Controller({
  group: AccountsRoutes,
  method: 'PUT',
  path: '/me',
  summary: 'Provision my account',
  body,
  response: { status: 200, description: 'The account, provisioned or refreshed; the body carries its identifier.', body: {{#if schemas.shared}}acceptedSchema{{/if}}{{#if schemas.perRoute}}accepted{{/if}} },
  errors: ['EMAIL_NOT_VERIFIED', 'INVALID_EMAIL_ADDRESS', 'INVALID_DISPLAY_NAME', 'ACCOUNT_DEACTIVATED'],
})
export class ProvisionAccountController {
  constructor(private readonly commands: CommandBus) {}

{{#if validation.classValidator}}
  async handle(request: HttpRequest<{ body: ProvisionAccountBody }>): Promise<{{#if schemas.shared}}Accepted{{/if}}{{#if schemas.perRoute}}ProvisionAccountAccepted{{/if}}> {
{{/if}}
{{#if validation.zod}}
  async handle(request: HttpRequest<{ body: Infer<typeof body> }>): Promise<{{#if schemas.shared}}Accepted{{/if}}{{#if schemas.perRoute}}Infer<typeof accepted>{{/if}}> {
{{/if}}
    const id = await this.commands.execute(new ProvisionAccountCommand(request.actor, profileOf(request.actor, request.body.displayName)));

    return { id };
  }
}

/**
 * The token is the authority on who the person is: their address comes from it, never from the
 * body, and with whether the provider verified it (`email_verified`), so that nobody accepts an
 * invitation sent to someone else by registering their address unverified.
 */
function profileOf(actor: Actor, displayName: string | undefined): ProvisionAccountCommand['profile'] {
  const { email, emailVerified, username } = actor.attributes;
  const address = typeof email === 'string' ? email : '';
  const named = displayName ?? (typeof username === 'string' ? username : address);

  return { email: address, emailVerified: emailVerified === true, displayName: named };
}
