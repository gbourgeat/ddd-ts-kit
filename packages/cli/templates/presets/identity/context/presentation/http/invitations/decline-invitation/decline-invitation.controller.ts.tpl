{{#if validation.classValidator}}
import { Controller, type HttpRequest } from '@ddd-ts-kit/http';
import type { CommandBus } from '@ddd-ts-kit/kernel';
import { classSchema } from '@ddd-ts-kit/validation/class-validator';
import { DeclineInvitationCommand } from '{{alias.context}}/application/commands/decline-invitation/decline-invitation.command{{alias.ext}}';
import { DeclineInvitationBody } from '{{alias.context}}/presentation/http/invitations/decline-invitation/decline-invitation.body{{alias.ext}}';
import { DeclineInvitationAccepted } from '{{alias.context}}/presentation/http/invitations/decline-invitation/decline-invitation.accepted{{alias.ext}}';
import { InvitationsRoutes } from '{{alias.context}}/presentation/http/invitations.routes{{alias.ext}}';
{{/if}}
{{#if validation.zod}}
import { z } from 'zod';
import { Controller, type HttpRequest } from '@ddd-ts-kit/http';
import type { CommandBus } from '@ddd-ts-kit/kernel';
import type { Infer } from '@ddd-ts-kit/validation';
import { zodSchema } from '@ddd-ts-kit/validation/zod';
import { DeclineInvitationCommand } from '{{alias.context}}/application/commands/decline-invitation/decline-invitation.command{{alias.ext}}';
import { InvitationsRoutes } from '{{alias.context}}/presentation/http/invitations.routes{{alias.ext}}';
{{/if}}

{{#if validation.classValidator}}
const body = classSchema(DeclineInvitationBody);
const accepted = classSchema(DeclineInvitationAccepted);
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
  path: '/declination',
  summary: 'Decline an invitation',
  body,
  response: { status: 200, description: 'Declined; the body carries the identifier of the invitation.', body: accepted },
  errors: [
    'INVITATION_NOT_FOUND',
    'ACCOUNT_NOT_FOUND',
    'INVITATION_NOT_PENDING',
    'INVITATION_EXPIRED',
    'INVITATION_ADDRESSED_TO_ANOTHER',
  ],
})
export class DeclineInvitationController {
  constructor(private readonly commands: CommandBus) {}

{{#if validation.classValidator}}
  async handle(request: HttpRequest<{ body: DeclineInvitationBody }>): Promise<DeclineInvitationAccepted> {
{{/if}}
{{#if validation.zod}}
  async handle(request: HttpRequest<{ body: Infer<typeof body> }>): Promise<Infer<typeof accepted>> {
{{/if}}
    const id = await this.commands.execute(new DeclineInvitationCommand(request.actor, request.body.token));

    return { id };
  }
}
