{{#if validation.classValidator}}
{{#if schemas.shared}}
import { acceptedSchema, Controller, type Accepted, type HttpRequest } from '@ddd-ts-kit/http';
{{/if}}
{{#if schemas.perRoute}}
import { Controller, type HttpRequest } from '@ddd-ts-kit/http';
{{/if}}
import type { CommandBus } from '@ddd-ts-kit/kernel';
import { classSchema } from '@ddd-ts-kit/validation/class-validator';
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
{{/if}}
{{#if validation.zod}}
{{#if schemas.perRoute}}
import { z } from 'zod';
{{/if}}
{{#if schemas.shared}}
import { acceptedSchema, Controller, type Accepted, type HttpRequest } from '@ddd-ts-kit/http';
{{/if}}
{{#if schemas.perRoute}}
import { Controller, type HttpRequest } from '@ddd-ts-kit/http';
{{/if}}
import type { CommandBus } from '@ddd-ts-kit/kernel';
import type { Infer } from '@ddd-ts-kit/validation';
import { zodSchema } from '@ddd-ts-kit/validation/zod';
import { AcceptInvitationCommand } from '{{alias.context}}/application/commands/accept-invitation/accept-invitation.command{{alias.ext}}';
{{#if schemas.shared}}
import { invitationTokenSchema } from '{{alias.context}}/presentation/http/shared/invitation-token.schema{{alias.ext}}';
{{/if}}
import { InvitationsRoutes } from '{{alias.context}}/presentation/http/invitations.routes{{alias.ext}}';
{{/if}}

{{#if validation.classValidator}}
{{#if schemas.shared}}
const body = classSchema(InvitationToken, { shared: true });
{{/if}}
{{#if schemas.perRoute}}
const body = classSchema(AcceptInvitationBody);
{{/if}}
{{#if schemas.perRoute}}
const accepted = classSchema(AcceptInvitationAccepted);
{{/if}}
{{/if}}
{{#if validation.zod}}
{{#if schemas.shared}}
const body = zodSchema(invitationTokenSchema);
{{/if}}
{{#if schemas.perRoute}}
const body = zodSchema(
  z.object({
    token: z.string().min(1),
  }),
);
{{/if}}

{{#if schemas.perRoute}}
const accepted = zodSchema(z.object({ id: z.string() }), { io: 'output' });
{{/if}}
{{/if}}

@Controller({
  group: InvitationsRoutes,
  method: 'POST',
  path: '/acceptance',
  summary: 'Accept an invitation',
  body,
  response: { status: 200, description: 'Accepted; the caller is a member, the body carries the identifier of the invitation.', body: {{#if schemas.shared}}acceptedSchema{{/if}}{{#if schemas.perRoute}}accepted{{/if}} },
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
export class AcceptInvitationController {
  constructor(private readonly commands: CommandBus) {}

{{#if validation.classValidator}}
  async handle(request: HttpRequest<{ body: {{#if schemas.shared}}InvitationToken{{/if}}{{#if schemas.perRoute}}AcceptInvitationBody{{/if}} }>): Promise<{{#if schemas.shared}}Accepted{{/if}}{{#if schemas.perRoute}}AcceptInvitationAccepted{{/if}}> {
{{/if}}
{{#if validation.zod}}
  async handle(request: HttpRequest<{ body: Infer<typeof body> }>): Promise<{{#if schemas.shared}}Accepted{{/if}}{{#if schemas.perRoute}}Infer<typeof accepted>{{/if}}> {
{{/if}}
    const id = await this.commands.execute(new AcceptInvitationCommand(request.actor, request.body.token));

    return { id };
  }
}
