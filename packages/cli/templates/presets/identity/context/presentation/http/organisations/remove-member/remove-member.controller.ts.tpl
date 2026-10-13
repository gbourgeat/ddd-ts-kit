{{#if validation.classValidator}}
import { Controller, type HttpRequest } from '@ddd-ts-kit/http';
import type { CommandBus } from '@ddd-ts-kit/kernel';
import { classSchema } from '@ddd-ts-kit/validation/class-validator';
import { RemoveMemberCommand } from '{{alias.context}}/application/commands/remove-member/remove-member.command{{alias.ext}}';
import { RemoveMemberParams } from '{{alias.context}}/presentation/http/organisations/remove-member/remove-member.params{{alias.ext}}';
import { RemoveMemberAccepted } from '{{alias.context}}/presentation/http/organisations/remove-member/remove-member.accepted{{alias.ext}}';
import { OrganisationsRoutes } from '{{alias.context}}/presentation/http/organisations.routes{{alias.ext}}';
{{/if}}
{{#if validation.zod}}
import { z } from 'zod';
import { Controller, type HttpRequest } from '@ddd-ts-kit/http';
import type { CommandBus } from '@ddd-ts-kit/kernel';
import type { Infer } from '@ddd-ts-kit/validation';
import { zodSchema } from '@ddd-ts-kit/validation/zod';
import { RemoveMemberCommand } from '{{alias.context}}/application/commands/remove-member/remove-member.command{{alias.ext}}';
import { OrganisationsRoutes } from '{{alias.context}}/presentation/http/organisations.routes{{alias.ext}}';
{{/if}}

{{#if validation.classValidator}}
const params = classSchema(RemoveMemberParams);
const accepted = classSchema(RemoveMemberAccepted);
{{/if}}
{{#if validation.zod}}
const params = zodSchema(
  z.object({
    organisationId: z.string().min(1),
    accountId: z.string().min(1),
  }),
);

const accepted = zodSchema(z.object({ id: z.string() }), { io: 'output' });
{{/if}}

@Controller({
  group: OrganisationsRoutes,
  method: 'DELETE',
  path: '/:organisationId/members/:accountId',
  summary: 'Remove a member',
  params,
  response: { status: 200, description: 'Removed; the body carries the identifier of the membership.', body: accepted },
  errors: ['MEMBER_NOT_FOUND', 'OWNERS_ONLY', 'LAST_OWNER'],
})
export class RemoveMemberController {
  constructor(private readonly commands: CommandBus) {}

{{#if validation.classValidator}}
  async handle(request: HttpRequest<{ params: RemoveMemberParams }>): Promise<RemoveMemberAccepted> {
{{/if}}
{{#if validation.zod}}
  async handle(request: HttpRequest<{ params: Infer<typeof params> }>): Promise<Infer<typeof accepted>> {
{{/if}}
    const id = await this.commands.execute(new RemoveMemberCommand(request.actor, request.params.organisationId, request.params.accountId));

    return { id };
  }
}
