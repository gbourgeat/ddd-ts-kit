import { Body, Controller, Inject, Param, Post } from '@nestjs/common';
import { CurrentActor, KitRoute, KitRoutes } from '@ddd-ts-kit/http/nest';
import { CommandBus, type Actor } from '@ddd-ts-kit/kernel';
import { InviteMemberCommand } from '{{alias.context}}/application/commands/invite-member/invite-member.command{{alias.ext}}';
import { InviteMemberParams } from '{{alias.context}}/presentation/http/organisations/invite-member/invite-member.params{{alias.ext}}';
import { InviteMemberBody } from '{{alias.context}}/presentation/http/organisations/invite-member/invite-member.body{{alias.ext}}';
import { InviteMemberAccepted } from '{{alias.context}}/presentation/http/organisations/invite-member/invite-member.accepted{{alias.ext}}';
import { OrganisationsRoutes } from '{{alias.context}}/presentation/http/organisations.routes{{alias.ext}}';

/** Built by Nest with the bus it injects, served by the kit: its parts and its answer are read from its signature. */
@Controller()
@KitRoutes({ group: OrganisationsRoutes })
export class InviteMemberController {
  constructor(@Inject(CommandBus) private readonly commands: CommandBus) {}

  @Post(':organisationId/invitations')
  @KitRoute({
    summary: 'Invite a person to the organisation',
    response: { description: 'Issued; the body carries the token to send to the person, given once and never stored.' },
    errors: ['INVALID_EMAIL_ADDRESS', 'ABOVE_OWN_ROLE', 'OWNERS_ONLY'],
  })
  async inviteMember(@Param() params: InviteMemberParams, @Body() body: InviteMemberBody, @CurrentActor() actor: Actor): Promise<InviteMemberAccepted> {
    return this.commands.execute(new InviteMemberCommand(actor, params.organisationId, body));
  }
}
