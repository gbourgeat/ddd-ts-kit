{{#if validation.classValidator}}
import { Controller, type HttpRequest } from '@ddd-ts-kit/http';
import type { CommandBus } from '@ddd-ts-kit/kernel';
import { classSchema } from '@ddd-ts-kit/validation/class-validator';
import { ChangeMemberRoleCommand } from '{{alias.context}}/application/commands/change-member-role/change-member-role.command{{alias.ext}}';
import { ChangeMemberRoleParams } from '{{alias.context}}/presentation/http/organisations/change-member-role/change-member-role.params{{alias.ext}}';
import { ChangeMemberRoleBody } from '{{alias.context}}/presentation/http/organisations/change-member-role/change-member-role.body{{alias.ext}}';
import { ChangeMemberRoleAccepted } from '{{alias.context}}/presentation/http/organisations/change-member-role/change-member-role.accepted{{alias.ext}}';
import { OrganisationsRoutes } from '{{alias.context}}/presentation/http/organisations.routes{{alias.ext}}';
{{/if}}
{{#if validation.zod}}
import { z } from 'zod';
import { Controller, type HttpRequest } from '@ddd-ts-kit/http';
import type { CommandBus } from '@ddd-ts-kit/kernel';
import type { Infer } from '@ddd-ts-kit/validation';
import { zodSchema } from '@ddd-ts-kit/validation/zod';
import { ChangeMemberRoleCommand } from '{{alias.context}}/application/commands/change-member-role/change-member-role.command{{alias.ext}}';
import { MemberRole } from '{{alias.context}}/domain/vocabularies/member-role.vocabulary{{alias.ext}}';
import { OrganisationsRoutes } from '{{alias.context}}/presentation/http/organisations.routes{{alias.ext}}';
{{/if}}

{{#if validation.classValidator}}
const params = classSchema(ChangeMemberRoleParams);
const body = classSchema(ChangeMemberRoleBody);
const accepted = classSchema(ChangeMemberRoleAccepted);
{{/if}}
{{#if validation.zod}}
const params = zodSchema(
  z.object({
    organisationId: z.string().min(1),
    accountId: z.string().min(1),
  }),
);

const body = zodSchema(
  z.object({
    role: z.enum(MemberRole),
  }),
);

const accepted = zodSchema(z.object({ id: z.string() }), { io: 'output' });
{{/if}}

@Controller({
  group: OrganisationsRoutes,
  method: 'PUT',
  path: '/:organisationId/members/:accountId/role',
  summary: 'Change the role of a member',
  params,
  body,
  response: { status: 200, description: 'Changed; the body carries the identifier of the membership.', body: accepted },
  errors: ['MEMBER_NOT_FOUND', 'OWNERS_ONLY', 'LAST_OWNER'],
})
export class ChangeMemberRoleController {
  constructor(private readonly commands: CommandBus) {}

{{#if validation.classValidator}}
  async handle(request: HttpRequest<{ params: ChangeMemberRoleParams; body: ChangeMemberRoleBody }>): Promise<ChangeMemberRoleAccepted> {
{{/if}}
{{#if validation.zod}}
  async handle(request: HttpRequest<{ params: Infer<typeof params>; body: Infer<typeof body> }>): Promise<Infer<typeof accepted>> {
{{/if}}
    const id = await this.commands.execute(new ChangeMemberRoleCommand(request.actor, request.params.organisationId, request.params.accountId, request.body.role));

    return { id };
  }
}
