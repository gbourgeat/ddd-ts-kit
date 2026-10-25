{{#if validation.classValidator}}
{{#if schemas.shared}}
import { acceptedSchema, Controller, type Accepted, type HttpRequest } from '@ddd-ts-kit/http';
{{/if}}
{{#if schemas.perRoute}}
import { Controller, type HttpRequest } from '@ddd-ts-kit/http';
{{/if}}
import type { CommandBus } from '@ddd-ts-kit/kernel';
import { classSchema } from '@ddd-ts-kit/validation/class-validator';
import { ChangeMemberRoleCommand } from '{{alias.context}}/application/commands/change-member-role/change-member-role.command{{alias.ext}}';
import { ChangeMemberRoleParams } from '{{alias.context}}/presentation/http/organisations/change-member-role/change-member-role.params{{alias.ext}}';
import { ChangeMemberRoleBody } from '{{alias.context}}/presentation/http/organisations/change-member-role/change-member-role.body{{alias.ext}}';
{{#if schemas.perRoute}}
import { ChangeMemberRoleAccepted } from '{{alias.context}}/presentation/http/organisations/change-member-role/change-member-role.accepted{{alias.ext}}';
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
import { ChangeMemberRoleCommand } from '{{alias.context}}/application/commands/change-member-role/change-member-role.command{{alias.ext}}';
import { MemberRole } from '{{alias.context}}/domain/vocabularies/member-role.vocabulary{{alias.ext}}';
import { OrganisationsRoutes } from '{{alias.context}}/presentation/http/organisations.routes{{alias.ext}}';
{{/if}}

{{#if validation.classValidator}}
const params = classSchema(ChangeMemberRoleParams);
const body = classSchema(ChangeMemberRoleBody);
{{#if schemas.perRoute}}
const accepted = classSchema(ChangeMemberRoleAccepted);
{{/if}}
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

{{#if schemas.perRoute}}
const accepted = zodSchema(z.object({ id: z.string() }), { io: 'output' });
{{/if}}
{{/if}}

@Controller({
  group: OrganisationsRoutes,
  method: 'PUT',
  path: '/:organisationId/members/:accountId/role',
  summary: 'Change the role of a member',
  params,
  body,
  response: { status: 200, description: 'Changed; the body carries the identifier of the membership.', body: {{#if schemas.shared}}acceptedSchema{{/if}}{{#if schemas.perRoute}}accepted{{/if}} },
  errors: ['ORGANISATION_NOT_FOUND', 'MEMBER_NOT_FOUND', 'OWN_ROLE', 'ABOVE_OWN_ROLE', 'OWNERS_ONLY', 'LAST_OWNER'],
})
export class ChangeMemberRoleController {
  constructor(private readonly commands: CommandBus) {}

{{#if validation.classValidator}}
  async handle(request: HttpRequest<{ params: ChangeMemberRoleParams; body: ChangeMemberRoleBody }>): Promise<{{#if schemas.shared}}Accepted{{/if}}{{#if schemas.perRoute}}ChangeMemberRoleAccepted{{/if}}> {
{{/if}}
{{#if validation.zod}}
  async handle(request: HttpRequest<{ params: Infer<typeof params>; body: Infer<typeof body> }>): Promise<{{#if schemas.shared}}Accepted{{/if}}{{#if schemas.perRoute}}Infer<typeof accepted>{{/if}}> {
{{/if}}
    const id = await this.commands.execute(new ChangeMemberRoleCommand(request.actor, request.params.organisationId, request.params.accountId, request.body.role));

    return { id };
  }
}
