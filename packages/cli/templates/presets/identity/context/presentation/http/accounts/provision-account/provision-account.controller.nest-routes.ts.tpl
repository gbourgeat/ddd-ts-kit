import { Body, Controller, Inject, Put } from '@nestjs/common';
{{#if schemas.shared}}
import type { Accepted } from '@ddd-ts-kit/http';
{{/if}}
import { CurrentActor, KitRoute, KitRoutes } from '@ddd-ts-kit/http/nest';
import { CommandBus, type Actor } from '@ddd-ts-kit/kernel';
import { ProvisionAccountCommand } from '{{alias.context}}/application/commands/provision-account/provision-account.command{{alias.ext}}';
import { ProvisionAccountBody } from '{{alias.context}}/presentation/http/accounts/provision-account/provision-account.body{{alias.ext}}';
{{#if schemas.perRoute}}
import { ProvisionAccountAccepted } from '{{alias.context}}/presentation/http/accounts/provision-account/provision-account.accepted{{alias.ext}}';
{{/if}}
import { AccountsRoutes } from '{{alias.context}}/presentation/http/accounts.routes{{alias.ext}}';

/** Built by Nest with the bus it injects, served by the kit: its parts and its answer are read from its signature. */
@Controller()
@KitRoutes({ group: AccountsRoutes })
export class ProvisionAccountController {
  constructor(@Inject(CommandBus) private readonly commands: CommandBus) {}

  @Put('me')
  @KitRoute({
    summary: 'Provision my account',
    response: { description: 'The account, provisioned or refreshed; the body carries its identifier.' },
    errors: ['EMAIL_NOT_VERIFIED', 'INVALID_EMAIL_ADDRESS', 'INVALID_DISPLAY_NAME', 'ACCOUNT_DEACTIVATED'],
  })
  async provisionAccount(@Body() body: ProvisionAccountBody, @CurrentActor() actor: Actor): Promise<{{#if schemas.shared}}Accepted{{/if}}{{#if schemas.perRoute}}ProvisionAccountAccepted{{/if}}> {
    const id = await this.commands.execute(new ProvisionAccountCommand(actor, profileOf(actor, body.displayName)));

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
