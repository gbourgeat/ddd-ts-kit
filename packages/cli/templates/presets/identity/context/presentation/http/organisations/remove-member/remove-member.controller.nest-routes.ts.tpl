import { Controller, Delete, Inject, Param } from '@nestjs/common';
{{#if schemas.shared}}
import type { Accepted } from '@ddd-ts-kit/http';
{{/if}}
import { CurrentActor, KitRoute, KitRoutes } from '@ddd-ts-kit/http/nest';
import { CommandBus, type Actor } from '@ddd-ts-kit/kernel';
import { RemoveMemberCommand } from '{{alias.context}}/application/commands/remove-member/remove-member.command{{alias.ext}}';
import { RemoveMemberParams } from '{{alias.context}}/presentation/http/organisations/remove-member/remove-member.params{{alias.ext}}';
{{#if schemas.perRoute}}
import { RemoveMemberAccepted } from '{{alias.context}}/presentation/http/organisations/remove-member/remove-member.accepted{{alias.ext}}';
{{/if}}
import { OrganisationsRoutes } from '{{alias.context}}/presentation/http/organisations.routes{{alias.ext}}';

/** Built by Nest with the bus it injects, served by the kit: its parts and its answer are read from its signature. */
@Controller()
@KitRoutes({ group: OrganisationsRoutes })
export class RemoveMemberController {
  constructor(@Inject(CommandBus) private readonly commands: CommandBus) {}

  @Delete(':organisationId/members/:accountId')
  @KitRoute({
    summary: 'Remove a member',
    response: { description: 'Removed; the body carries the identifier of the membership.' },
    errors: ['ORGANISATION_NOT_FOUND', 'MEMBER_NOT_FOUND', 'ABOVE_OWN_ROLE', 'OWNERS_ONLY', 'LAST_OWNER'],
  })
  async removeMember(@Param() params: RemoveMemberParams, @CurrentActor() actor: Actor): Promise<{{#if schemas.shared}}Accepted{{/if}}{{#if schemas.perRoute}}RemoveMemberAccepted{{/if}}> {
    const id = await this.commands.execute(new RemoveMemberCommand(actor, params.organisationId, params.accountId));

    return { id };
  }
}
