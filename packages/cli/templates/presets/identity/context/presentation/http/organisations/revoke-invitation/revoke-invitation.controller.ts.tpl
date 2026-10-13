{{#if validation.classValidator}}
import { Controller, type HttpRequest } from '@ddd-ts-kit/http';
import type { CommandBus } from '@ddd-ts-kit/kernel';
import { classSchema } from '@ddd-ts-kit/validation/class-validator';
import { RevokeInvitationCommand } from '{{alias.context}}/application/commands/revoke-invitation/revoke-invitation.command{{alias.ext}}';
import { RevokeInvitationParams } from '{{alias.context}}/presentation/http/organisations/revoke-invitation/revoke-invitation.params{{alias.ext}}';
import { RevokeInvitationAccepted } from '{{alias.context}}/presentation/http/organisations/revoke-invitation/revoke-invitation.accepted{{alias.ext}}';
import { OrganisationsRoutes } from '{{alias.context}}/presentation/http/organisations.routes{{alias.ext}}';
{{/if}}
{{#if validation.zod}}
import { z } from 'zod';
import { Controller, type HttpRequest } from '@ddd-ts-kit/http';
import type { CommandBus } from '@ddd-ts-kit/kernel';
import type { Infer } from '@ddd-ts-kit/validation';
import { zodSchema } from '@ddd-ts-kit/validation/zod';
import { RevokeInvitationCommand } from '{{alias.context}}/application/commands/revoke-invitation/revoke-invitation.command{{alias.ext}}';
import { OrganisationsRoutes } from '{{alias.context}}/presentation/http/organisations.routes{{alias.ext}}';
{{/if}}

{{#if validation.classValidator}}
const params = classSchema(RevokeInvitationParams);
const accepted = classSchema(RevokeInvitationAccepted);
{{/if}}
{{#if validation.zod}}
const params = zodSchema(
  z.object({
    organisationId: z.string().min(1),
    invitationId: z.string().min(1),
  }),
);

const accepted = zodSchema(z.object({ id: z.string() }), { io: 'output' });
{{/if}}

@Controller({
  group: OrganisationsRoutes,
  method: 'DELETE',
  path: '/:organisationId/invitations/:invitationId',
  summary: 'Take back an invitation',
  params,
  response: { status: 200, description: 'Taken back; the body carries its identifier.', body: accepted },
  errors: ['INVITATION_NOT_FOUND', 'INVITATION_NOT_PENDING'],
})
export class RevokeInvitationController {
  constructor(private readonly commands: CommandBus) {}

{{#if validation.classValidator}}
  async handle(request: HttpRequest<{ params: RevokeInvitationParams }>): Promise<RevokeInvitationAccepted> {
{{/if}}
{{#if validation.zod}}
  async handle(request: HttpRequest<{ params: Infer<typeof params> }>): Promise<Infer<typeof accepted>> {
{{/if}}
    const id = await this.commands.execute(new RevokeInvitationCommand(request.actor, request.params.organisationId, request.params.invitationId));

    return { id };
  }
}
