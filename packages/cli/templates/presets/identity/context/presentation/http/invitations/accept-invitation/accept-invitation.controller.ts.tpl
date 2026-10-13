{{#if validation.classValidator}}
import { Controller, type HttpRequest } from '@ddd-ts-kit/http';
import type { CommandBus } from '@ddd-ts-kit/kernel';
import { classSchema } from '@ddd-ts-kit/validation/class-validator';
import { AcceptInvitationCommand } from '{{alias.context}}/application/commands/accept-invitation/accept-invitation.command{{alias.ext}}';
import { AcceptInvitationBody } from '{{alias.context}}/presentation/http/invitations/accept-invitation/accept-invitation.body{{alias.ext}}';
import { AcceptInvitationAccepted } from '{{alias.context}}/presentation/http/invitations/accept-invitation/accept-invitation.accepted{{alias.ext}}';
import { InvitationsRoutes } from '{{alias.context}}/presentation/http/invitations.routes{{alias.ext}}';
{{/if}}
{{#if validation.zod}}
import { z } from 'zod';
import { Controller, type HttpRequest } from '@ddd-ts-kit/http';
import type { CommandBus } from '@ddd-ts-kit/kernel';
import type { Infer } from '@ddd-ts-kit/validation';
import { zodSchema } from '@ddd-ts-kit/validation/zod';
import { AcceptInvitationCommand } from '{{alias.context}}/application/commands/accept-invitation/accept-invitation.command{{alias.ext}}';
import { InvitationsRoutes } from '{{alias.context}}/presentation/http/invitations.routes{{alias.ext}}';
{{/if}}

{{#if validation.classValidator}}
const body = classSchema(AcceptInvitationBody);
const accepted = classSchema(AcceptInvitationAccepted);
{{/if}}
{{#if validation.zod}}
const body = zodSchema(
  z.object({
    token: z.string().min(1),
  }),
);

const accepted = zodSchema(z.object({ id: z.string() }), { io: 'output' });
{{/if}}

@Controller({
  group: InvitationsRoutes,
  method: 'POST',
  path: '/acceptance',
  summary: 'Accept an invitation',
  body,
  response: { status: 200, description: 'Accepted; the caller is a member, the body carries the identifier of the invitation.', body: accepted },
  errors: [
    'INVITATION_NOT_FOUND',
    'ACCOUNT_NOT_FOUND',
    'ACCOUNT_DEACTIVATED',
    'INVITATION_NOT_PENDING',
    'INVITATION_EXPIRED',
    'INVITATION_ADDRESSED_TO_ANOTHER',
    'ALREADY_MEMBER',
  ],
})
export class AcceptInvitationController {
  constructor(private readonly commands: CommandBus) {}

{{#if validation.classValidator}}
  async handle(request: HttpRequest<{ body: AcceptInvitationBody }>): Promise<AcceptInvitationAccepted> {
{{/if}}
{{#if validation.zod}}
  async handle(request: HttpRequest<{ body: Infer<typeof body> }>): Promise<Infer<typeof accepted>> {
{{/if}}
    const id = await this.commands.execute(new AcceptInvitationCommand(request.actor, request.body.token));

    return { id };
  }
}
