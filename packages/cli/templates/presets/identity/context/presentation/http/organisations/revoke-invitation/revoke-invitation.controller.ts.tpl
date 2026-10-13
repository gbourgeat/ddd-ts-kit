{{#if validation.classValidator}}
{{#if schemas.shared}}
import { acceptedSchema, Controller, type Accepted, type HttpRequest } from '@ddd-ts-kit/http';
{{/if}}
{{#if schemas.perRoute}}
import { Controller, type HttpRequest } from '@ddd-ts-kit/http';
{{/if}}
import type { CommandBus } from '@ddd-ts-kit/kernel';
import { classSchema } from '@ddd-ts-kit/validation/class-validator';
import { RevokeInvitationCommand } from '{{alias.context}}/application/commands/revoke-invitation/revoke-invitation.command{{alias.ext}}';
import { RevokeInvitationParams } from '{{alias.context}}/presentation/http/organisations/revoke-invitation/revoke-invitation.params{{alias.ext}}';
{{#if schemas.perRoute}}
import { RevokeInvitationAccepted } from '{{alias.context}}/presentation/http/organisations/revoke-invitation/revoke-invitation.accepted{{alias.ext}}';
{{/if}}
import { OrganisationsRoutes } from '{{alias.context}}/presentation/http/organisations.routes{{alias.ext}}';
{{/if}}
{{#if validation.zod}}
import { z } from 'zod';
{{#if schemas.shared}}
import { acceptedSchema, Controller, type Accepted, type HttpRequest } from '@ddd-ts-kit/http';
{{/if}}
{{#if schemas.perRoute}}
import { Controller, type HttpRequest } from '@ddd-ts-kit/http';
{{/if}}
import type { CommandBus } from '@ddd-ts-kit/kernel';
import type { Infer } from '@ddd-ts-kit/validation';
import { zodSchema } from '@ddd-ts-kit/validation/zod';
import { RevokeInvitationCommand } from '{{alias.context}}/application/commands/revoke-invitation/revoke-invitation.command{{alias.ext}}';
import { OrganisationsRoutes } from '{{alias.context}}/presentation/http/organisations.routes{{alias.ext}}';
{{/if}}

{{#if validation.classValidator}}
const params = classSchema(RevokeInvitationParams);
{{#if schemas.perRoute}}
const accepted = classSchema(RevokeInvitationAccepted);
{{/if}}
{{/if}}
{{#if validation.zod}}
const params = zodSchema(
  z.object({
    organisationId: z.string().min(1),
    invitationId: z.string().min(1),
  }),
);

{{#if schemas.perRoute}}
const accepted = zodSchema(z.object({ id: z.string() }), { io: 'output' });
{{/if}}
{{/if}}

@Controller({
  group: OrganisationsRoutes,
  method: 'DELETE',
  path: '/:organisationId/invitations/:invitationId',
  summary: 'Take back an invitation',
  params,
  response: { status: 200, description: 'Taken back; the body carries its identifier.', body: {{#if schemas.shared}}acceptedSchema{{/if}}{{#if schemas.perRoute}}accepted{{/if}} },
  errors: ['INVITATION_NOT_FOUND', 'INVITATION_NOT_PENDING'],
})
export class RevokeInvitationController {
  constructor(private readonly commands: CommandBus) {}

{{#if validation.classValidator}}
  async handle(request: HttpRequest<{ params: RevokeInvitationParams }>): Promise<{{#if schemas.shared}}Accepted{{/if}}{{#if schemas.perRoute}}RevokeInvitationAccepted{{/if}}> {
{{/if}}
{{#if validation.zod}}
  async handle(request: HttpRequest<{ params: Infer<typeof params> }>): Promise<{{#if schemas.shared}}Accepted{{/if}}{{#if schemas.perRoute}}Infer<typeof accepted>{{/if}}> {
{{/if}}
    const id = await this.commands.execute(new RevokeInvitationCommand(request.actor, request.params.organisationId, request.params.invitationId));

    return { id };
  }
}
