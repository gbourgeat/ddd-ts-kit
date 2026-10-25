import { Controller, Delete, Inject, Param } from '@nestjs/common';
{{#if schemas.shared}}
import type { Accepted } from '@ddd-ts-kit/http';
{{/if}}
import { CurrentActor, KitRoute, KitRoutes } from '@ddd-ts-kit/http/nest';
import { CommandBus, type Actor } from '@ddd-ts-kit/kernel';
import { RevokeInvitationCommand } from '{{alias.context}}/application/commands/revoke-invitation/revoke-invitation.command{{alias.ext}}';
import { RevokeInvitationParams } from '{{alias.context}}/presentation/http/organisations/revoke-invitation/revoke-invitation.params{{alias.ext}}';
{{#if schemas.perRoute}}
import { RevokeInvitationAccepted } from '{{alias.context}}/presentation/http/organisations/revoke-invitation/revoke-invitation.accepted{{alias.ext}}';
{{/if}}
import { OrganisationsRoutes } from '{{alias.context}}/presentation/http/organisations.routes{{alias.ext}}';

/** Built by Nest with the bus it injects, served by the kit: its parts and its answer are read from its signature. */
@Controller()
@KitRoutes({ group: OrganisationsRoutes })
export class RevokeInvitationController {
  constructor(@Inject(CommandBus) private readonly commands: CommandBus) {}

  @Delete(':organisationId/invitations/:invitationId')
  @KitRoute({
    summary: 'Take back an invitation',
    response: { description: 'Taken back; the body carries its identifier.' },
    errors: ['INVITATION_NOT_FOUND', 'INVITATION_NOT_PENDING'],
  })
  async revokeInvitation(@Param() params: RevokeInvitationParams, @CurrentActor() actor: Actor): Promise<{{#if schemas.shared}}Accepted{{/if}}{{#if schemas.perRoute}}RevokeInvitationAccepted{{/if}}> {
    const id = await this.commands.execute(new RevokeInvitationCommand(actor, params.organisationId, params.invitationId));

    return { id };
  }
}
