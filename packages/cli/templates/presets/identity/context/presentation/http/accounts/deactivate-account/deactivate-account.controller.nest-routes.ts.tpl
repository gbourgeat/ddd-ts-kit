import { Controller, HttpCode, Inject, Post } from '@nestjs/common';
{{#if schemas.shared}}
import type { Accepted } from '@ddd-ts-kit/http';
{{/if}}
import { CurrentActor, KitRoute, KitRoutes } from '@ddd-ts-kit/http/nest';
import { CommandBus, type Actor } from '@ddd-ts-kit/kernel';
import { DeactivateAccountCommand } from '{{alias.context}}/application/commands/deactivate-account/deactivate-account.command{{alias.ext}}';
{{#if schemas.perRoute}}
import { DeactivateAccountAccepted } from '{{alias.context}}/presentation/http/accounts/deactivate-account/deactivate-account.accepted{{alias.ext}}';
{{/if}}
import { AccountsRoutes } from '{{alias.context}}/presentation/http/accounts.routes{{alias.ext}}';

/** Built by Nest with the bus it injects, served by the kit: its parts and its answer are read from its signature. */
@Controller()
@KitRoutes({ group: AccountsRoutes })
export class DeactivateAccountController {
  constructor(@Inject(CommandBus) private readonly commands: CommandBus) {}

  @Post('me/deactivation')
  @HttpCode(200)
  @KitRoute({
    summary: 'Deactivate my account',
    response: { description: 'The account is deactivated; the body carries its identifier.' },
    errors: ['ACCOUNT_NOT_FOUND', 'ACCOUNT_ALREADY_DEACTIVATED', 'ORGANISATION_NOT_FOUND', 'LAST_OWNER'],
  })
  async deactivateAccount(@CurrentActor() actor: Actor): Promise<{{#if schemas.shared}}Accepted{{/if}}{{#if schemas.perRoute}}DeactivateAccountAccepted{{/if}}> {
    const id = await this.commands.execute(new DeactivateAccountCommand(actor));

    return { id };
  }
}
