{{#if validation.classValidator}}
import { Controller, type HttpRequest } from '@ddd-ts-kit/http';
import type { CommandBus } from '@ddd-ts-kit/kernel';
import { classSchema } from '@ddd-ts-kit/validation/class-validator';
import { InviteMemberCommand } from '{{alias.context}}/application/commands/invite-member/invite-member.command{{alias.ext}}';
import { InviteMemberParams } from '{{alias.context}}/presentation/http/organisations/invite-member/invite-member.params{{alias.ext}}';
import { InviteMemberBody } from '{{alias.context}}/presentation/http/organisations/invite-member/invite-member.body{{alias.ext}}';
import { InviteMemberAccepted } from '{{alias.context}}/presentation/http/organisations/invite-member/invite-member.accepted{{alias.ext}}';
import { OrganisationsRoutes } from '{{alias.context}}/presentation/http/organisations.routes{{alias.ext}}';
{{/if}}
{{#if validation.zod}}
import { z } from 'zod';
import { Controller, type HttpRequest } from '@ddd-ts-kit/http';
import type { CommandBus } from '@ddd-ts-kit/kernel';
import type { Infer } from '@ddd-ts-kit/validation';
import { zodSchema } from '@ddd-ts-kit/validation/zod';
import { InviteMemberCommand } from '{{alias.context}}/application/commands/invite-member/invite-member.command{{alias.ext}}';
import { MemberRole } from '{{alias.context}}/domain/vocabularies/member-role.vocabulary{{alias.ext}}';
import { OrganisationsRoutes } from '{{alias.context}}/presentation/http/organisations.routes{{alias.ext}}';
{{/if}}

{{#if validation.classValidator}}
const params = classSchema(InviteMemberParams);
const body = classSchema(InviteMemberBody);
const accepted = classSchema(InviteMemberAccepted);
{{/if}}
{{#if validation.zod}}
const params = zodSchema(
  z.object({
    organisationId: z.string().min(1),
  }),
);

const body = zodSchema(
  z.object({
    email: z.email(),
    role: z.enum(MemberRole),
  }),
);

const accepted = zodSchema(z.object({ id: z.string(), token: z.string() }), { io: 'output' });
{{/if}}

@Controller({
  group: OrganisationsRoutes,
  method: 'POST',
  path: '/:organisationId/invitations',
  summary: 'Invite a person to the organisation',
  params,
  body,
  response: { status: 201, description: 'Issued; the body carries the token to send to the person, given once and never stored.', body: accepted },
  errors: ['INVALID_EMAIL_ADDRESS', 'ABOVE_OWN_ROLE', 'OWNERS_ONLY'],
})
export class InviteMemberController {
  constructor(private readonly commands: CommandBus) {}

{{#if validation.classValidator}}
  async handle(request: HttpRequest<{ params: InviteMemberParams; body: InviteMemberBody }>): Promise<InviteMemberAccepted> {
{{/if}}
{{#if validation.zod}}
  async handle(request: HttpRequest<{ params: Infer<typeof params>; body: Infer<typeof body> }>): Promise<Infer<typeof accepted>> {
{{/if}}
    return this.commands.execute(new InviteMemberCommand(request.actor, request.params.organisationId, request.body));
  }
}
