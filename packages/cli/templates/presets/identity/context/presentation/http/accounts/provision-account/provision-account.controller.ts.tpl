{{#if validation.classValidator}}
import { Controller, type HttpRequest } from '@ddd-ts-kit/http';
import type { Actor, CommandBus } from '@ddd-ts-kit/kernel';
import { classSchema } from '@ddd-ts-kit/validation/class-validator';
import { ProvisionAccountCommand } from '{{alias.context}}/application/commands/provision-account/provision-account.command{{alias.ext}}';
import { ProvisionAccountBody } from '{{alias.context}}/presentation/http/accounts/provision-account/provision-account.body{{alias.ext}}';
import { ProvisionAccountAccepted } from '{{alias.context}}/presentation/http/accounts/provision-account/provision-account.accepted{{alias.ext}}';
import { AccountsRoutes } from '{{alias.context}}/presentation/http/accounts.routes{{alias.ext}}';
{{/if}}
{{#if validation.zod}}
import { z } from 'zod';
import { Controller, type HttpRequest } from '@ddd-ts-kit/http';
import type { Actor, CommandBus } from '@ddd-ts-kit/kernel';
import type { Infer } from '@ddd-ts-kit/validation';
import { zodSchema } from '@ddd-ts-kit/validation/zod';
import { ProvisionAccountCommand } from '{{alias.context}}/application/commands/provision-account/provision-account.command{{alias.ext}}';
import { AccountsRoutes } from '{{alias.context}}/presentation/http/accounts.routes{{alias.ext}}';
{{/if}}

{{#if validation.classValidator}}
const body = classSchema(ProvisionAccountBody);
const accepted = classSchema(ProvisionAccountAccepted);
{{/if}}
{{#if validation.zod}}
const body = zodSchema(
  z.object({
    displayName: z.string().min(1).optional(),
  }),
);

const accepted = zodSchema(z.object({ id: z.string() }), { io: 'output' });
{{/if}}

@Controller({
  group: AccountsRoutes,
  method: 'PUT',
  path: '/me',
  summary: 'Provision my account',
  body,
  response: { status: 200, description: 'The account, provisioned or refreshed; the body carries its identifier.', body: accepted },
  errors: ['INVALID_EMAIL_ADDRESS', 'INVALID_DISPLAY_NAME', 'ACCOUNT_DEACTIVATED'],
})
export class ProvisionAccountController {
  constructor(private readonly commands: CommandBus) {}

{{#if validation.classValidator}}
  async handle(request: HttpRequest<{ body: ProvisionAccountBody }>): Promise<ProvisionAccountAccepted> {
{{/if}}
{{#if validation.zod}}
  async handle(request: HttpRequest<{ body: Infer<typeof body> }>): Promise<Infer<typeof accepted>> {
{{/if}}
    const id = await this.commands.execute(new ProvisionAccountCommand(request.actor, profileOf(request.actor, request.body.displayName)));

    return { id };
  }
}

/** The token is the authority on who the person is: their address comes from it, never from the body, so that nobody accepts an invitation sent to someone else. */
function profileOf(actor: Actor, displayName: string | undefined): ProvisionAccountCommand['profile'] {
  const { email, username } = actor.attributes;
  const address = typeof email === 'string' ? email : '';

  return { email: address, displayName: displayName ?? (typeof username === 'string' ? username : address) };
}
