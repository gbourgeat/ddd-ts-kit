import { Body, Controller, Inject, Param, Put } from '@nestjs/common';
{{#if schemas.shared}}
import type { Accepted } from '@ddd-ts-kit/http';
{{/if}}
import { CurrentActor, KitRoute, KitRoutes } from '@ddd-ts-kit/http/nest';
import { CommandBus, type Actor } from '@ddd-ts-kit/kernel';
import { ChangeMemberRoleCommand } from '{{alias.context}}/application/commands/change-member-role/change-member-role.command{{alias.ext}}';
import { ChangeMemberRoleParams } from '{{alias.context}}/presentation/http/organisations/change-member-role/change-member-role.params{{alias.ext}}';
import { ChangeMemberRoleBody } from '{{alias.context}}/presentation/http/organisations/change-member-role/change-member-role.body{{alias.ext}}';
{{#if schemas.perRoute}}
import { ChangeMemberRoleAccepted } from '{{alias.context}}/presentation/http/organisations/change-member-role/change-member-role.accepted{{alias.ext}}';
{{/if}}
import { OrganisationsRoutes } from '{{alias.context}}/presentation/http/organisations.routes{{alias.ext}}';

/** Built by Nest with the bus it injects, served by the kit: its parts and its answer are read from its signature. */
@Controller()
@KitRoutes({ group: OrganisationsRoutes })
export class ChangeMemberRoleController {
  constructor(@Inject(CommandBus) private readonly commands: CommandBus) {}

  @Put(':organisationId/members/:accountId/role')
  @KitRoute({
    summary: 'Change the role of a member',
    response: { description: 'Changed; the body carries the identifier of the membership.' },
    errors: ['ORGANISATION_NOT_FOUND', 'MEMBER_NOT_FOUND', 'OWN_ROLE', 'ABOVE_OWN_ROLE', 'OWNERS_ONLY', 'LAST_OWNER'],
  })
  async changeMemberRole(@Param() params: ChangeMemberRoleParams, @Body() body: ChangeMemberRoleBody, @CurrentActor() actor: Actor): Promise<{{#if schemas.shared}}Accepted{{/if}}{{#if schemas.perRoute}}ChangeMemberRoleAccepted{{/if}}> {
    const id = await this.commands.execute(new ChangeMemberRoleCommand(actor, params.organisationId, params.accountId, body.role));

    return { id };
  }
}
