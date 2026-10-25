import { Body, Controller, HttpCode, Inject, Post } from '@nestjs/common';
{{#if schemas.shared}}
import type { Accepted } from '@ddd-ts-kit/http';
{{/if}}
import { CurrentActor, KitRoute, KitRoutes } from '@ddd-ts-kit/http/nest';
import { CommandBus, type Actor } from '@ddd-ts-kit/kernel';
{{#if schemas.shared}}
import { classSchema } from '@ddd-ts-kit/validation/class-validator';
{{/if}}
import { DeclineInvitationCommand } from '{{alias.context}}/application/commands/decline-invitation/decline-invitation.command{{alias.ext}}';
{{#if schemas.shared}}
import { InvitationToken } from '{{alias.context}}/presentation/http/shared/invitation-token.schema{{alias.ext}}';
{{/if}}
{{#if schemas.perRoute}}
import { DeclineInvitationBody } from '{{alias.context}}/presentation/http/invitations/decline-invitation/decline-invitation.body{{alias.ext}}';
{{/if}}
{{#if schemas.perRoute}}
import { DeclineInvitationAccepted } from '{{alias.context}}/presentation/http/invitations/decline-invitation/decline-invitation.accepted{{alias.ext}}';
{{/if}}
import { InvitationsRoutes } from '{{alias.context}}/presentation/http/invitations.routes{{alias.ext}}';

{{#if schemas.shared}}
/** The token every invitation route reads, documented once under its name. */
const token = classSchema(InvitationToken, { shared: true });

{{/if}}
/** Built by Nest with the bus it injects, served by the kit: its parts and its answer are read from its signature. */
@Controller()
@KitRoutes({ group: InvitationsRoutes })
export class DeclineInvitationController {
  constructor(@Inject(CommandBus) private readonly commands: CommandBus) {}

  @Post('declination')
  @HttpCode(200)
  @KitRoute({
    summary: 'Decline an invitation',
{{#if schemas.shared}}
    request: { body: token },
{{/if}}
    response: { description: 'Declined; the body carries the identifier of the invitation.' },
    errors: [
      'INVITATION_NOT_FOUND',
      'ACCOUNT_NOT_FOUND',
      'INVITATION_NOT_PENDING',
      'INVITATION_EXPIRED',
      'INVITATION_ADDRESSED_TO_ANOTHER',
    ],
  })
  async declineInvitation(@Body() body: {{#if schemas.shared}}InvitationToken{{/if}}{{#if schemas.perRoute}}DeclineInvitationBody{{/if}}, @CurrentActor() actor: Actor): Promise<{{#if schemas.shared}}Accepted{{/if}}{{#if schemas.perRoute}}DeclineInvitationAccepted{{/if}}> {
    const id = await this.commands.execute(new DeclineInvitationCommand(actor, body.token));

    return { id };
  }
}
