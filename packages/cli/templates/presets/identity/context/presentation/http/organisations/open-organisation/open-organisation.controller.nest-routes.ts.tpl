import { Body, Controller, Inject, Post } from '@nestjs/common';
{{#if schemas.shared}}
import type { Accepted } from '@ddd-ts-kit/http';
{{/if}}
import { CurrentActor, KitRoute, KitRoutes } from '@ddd-ts-kit/http/nest';
import { CommandBus, type Actor } from '@ddd-ts-kit/kernel';
import { OpenOrganisationCommand } from '{{alias.context}}/application/commands/open-organisation/open-organisation.command{{alias.ext}}';
import { OpenOrganisationBody } from '{{alias.context}}/presentation/http/organisations/open-organisation/open-organisation.body{{alias.ext}}';
{{#if schemas.perRoute}}
import { OpenOrganisationAccepted } from '{{alias.context}}/presentation/http/organisations/open-organisation/open-organisation.accepted{{alias.ext}}';
{{/if}}
import { OrganisationsRoutes } from '{{alias.context}}/presentation/http/organisations.routes{{alias.ext}}';

/** Built by Nest with the bus it injects, served by the kit: its parts and its answer are read from its signature. */
@Controller()
@KitRoutes({ group: OrganisationsRoutes })
export class OpenOrganisationController {
  constructor(@Inject(CommandBus) private readonly commands: CommandBus) {}

  @Post()
  @KitRoute({
    summary: 'Open an organisation',
    response: { description: 'Opened; the body carries its slug, the caller is its first owner.' },
    errors: [
      'ACCOUNT_NOT_FOUND',
      'ACCOUNT_DEACTIVATED',
      'ORGANISATION_SLUG_TAKEN',
      'INVALID_ORGANISATION_SLUG',
      'INVALID_ORGANISATION_NAME',
    ],
  })
  async openOrganisation(@Body() body: OpenOrganisationBody, @CurrentActor() actor: Actor): Promise<{{#if schemas.shared}}Accepted{{/if}}{{#if schemas.perRoute}}OpenOrganisationAccepted{{/if}}> {
    const id = await this.commands.execute(new OpenOrganisationCommand(actor, body));

    return { id };
  }
}
