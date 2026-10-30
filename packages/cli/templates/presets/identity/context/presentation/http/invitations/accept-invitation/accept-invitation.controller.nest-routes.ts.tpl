import { Body, Controller, HttpCode, Inject, Post } from '@nestjs/common';
{{#if schemas.shared}}
import type { Accepted } from '@ddd-ts-kit/http';
{{/if}}
import { CurrentActor, KitRoute, KitRoutes } from '@ddd-ts-kit/http/nest';
import { CommandBus, type Actor } from '@ddd-ts-kit/kernel';
{{#if schemas.shared}}
import { classSchema } from '@ddd-ts-kit/validation/class-validator';
{{/if}}
import { AcceptInvitationCommand } from '{{alias.context}}/application/commands/accept-invitation/accept-invitation.command{{alias.ext}}';
{{#if schemas.shared}}
import { InvitationToken } from '{{alias.context}}/presentation/http/shared/invitation-token.schema{{alias.ext}}';
{{/if}}
{{#if schemas.perRoute}}
import { AcceptInvitationBody } from '{{alias.context}}/presentation/http/invitations/accept-invitation/accept-invitation.body{{alias.ext}}';
{{/if}}
{{#if schemas.perRoute}}
import { AcceptInvitationAccepted } from '{{alias.context}}/presentation/http/invitations/accept-invitation/accept-invitation.accepted{{alias.ext}}';
{{/if}}
import { InvitationsRoutes } from '{{alias.context}}/presentation/http/invitations.routes{{alias.ext}}';

{{#if schemas.shared}}
/** The token every invitation route reads, documented once under its name. */
const token = classSchema(InvitationToken, { shared: true });

{{/if}}
/** Built by Nest with the bus it injects, served by the kit: its parts and its answer are read from its signature. */
@Controller()
@KitRoutes({ group: InvitationsRoutes })
export class AcceptInvitationController {
  constructor(@Inject(CommandBus) private readonly commands: CommandBus) {}

  @Post('acceptance')
  @HttpCode(200)
  @KitRoute({
    summary: 'Accept an invitation',
{{#if schemas.shared}}
    request: { body: token },
{{/if}}
    response: { description: 'Accepted; the caller is a member, the body carries the identifier of the invitation.' },
    errors: [
      'INVITATION_NOT_FOUND',
      'ACCOUNT_NOT_FOUND',
      'ACCOUNT_DEACTIVATED',
      'INVITATION_NOT_PENDING',
      'INVITATION_EXPIRED',
      'INVITATION_ADDRESSED_TO_ANOTHER',
      'ALREADY_MEMBER',
      'INVITATION_WITHDRAWN',
    ],
  })
  async acceptInvitation(@Body() body: {{#if schemas.shared}}InvitationToken{{/if}}{{#if schemas.perRoute}}AcceptInvitationBody{{/if}}, @CurrentActor() actor: Actor): Promise<{{#if schemas.shared}}Accepted{{/if}}{{#if schemas.perRoute}}AcceptInvitationAccepted{{/if}}> {
    const id = await this.commands.execute(new AcceptInvitationCommand(actor, body.token));

    return { id };
  }
}
