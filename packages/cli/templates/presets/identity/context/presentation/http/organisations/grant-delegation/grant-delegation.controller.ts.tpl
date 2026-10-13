{{#if validation.classValidator}}
{{#if schemas.shared}}
import { acceptedSchema, Controller, type Accepted, type HttpRequest } from '@ddd-ts-kit/http';
{{/if}}
{{#if schemas.perRoute}}
import { Controller, type HttpRequest } from '@ddd-ts-kit/http';
{{/if}}
import type { CommandBus } from '@ddd-ts-kit/kernel';
import { classSchema } from '@ddd-ts-kit/validation/class-validator';
import { GrantDelegationCommand } from '{{alias.context}}/application/commands/grant-delegation/grant-delegation.command{{alias.ext}}';
import { GrantDelegationParams } from '{{alias.context}}/presentation/http/organisations/grant-delegation/grant-delegation.params{{alias.ext}}';
import { GrantDelegationBody } from '{{alias.context}}/presentation/http/organisations/grant-delegation/grant-delegation.body{{alias.ext}}';
{{#if schemas.perRoute}}
import { GrantDelegationAccepted } from '{{alias.context}}/presentation/http/organisations/grant-delegation/grant-delegation.accepted{{alias.ext}}';
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
import { GrantDelegationCommand } from '{{alias.context}}/application/commands/grant-delegation/grant-delegation.command{{alias.ext}}';
import { MemberRight } from '{{alias.context}}/domain/vocabularies/member-right.vocabulary{{alias.ext}}';
import { OrganisationsRoutes } from '{{alias.context}}/presentation/http/organisations.routes{{alias.ext}}';
{{/if}}

{{#if validation.classValidator}}
const params = classSchema(GrantDelegationParams);
const body = classSchema(GrantDelegationBody);
{{#if schemas.perRoute}}
const accepted = classSchema(GrantDelegationAccepted);
{{/if}}
{{/if}}
{{#if validation.zod}}
const params = zodSchema(
  z.object({
    organisationId: z.string().min(1),
  }),
);

const body = zodSchema(
  z.object({
    delegateId: z.string().min(1),
    rights: z.array(z.enum(MemberRight)).min(1),
    startsAt: z.iso.datetime(),
    endsAt: z.iso.datetime(),
  }),
);

{{#if schemas.perRoute}}
const accepted = zodSchema(z.object({ id: z.string() }), { io: 'output' });
{{/if}}
{{/if}}

@Controller({
  group: OrganisationsRoutes,
  method: 'POST',
  path: '/:organisationId/delegations',
  summary: 'Lend rights to a member',
  params,
  body,
  response: { status: 201, description: 'Granted; the body carries the identifier of the delegation.', body: {{#if schemas.shared}}acceptedSchema{{/if}}{{#if schemas.perRoute}}accepted{{/if}} },
  errors: [
    'MEMBER_NOT_FOUND',
    'DELEGATION_TO_ONESELF',
    'DELEGATION_WITHOUT_RIGHTS',
    'DELEGATION_BEYOND_RIGHTS',
    'DELEGATION_PERIOD_INVERTED',
    'DELEGATION_TOO_LONG',
  ],
})
export class GrantDelegationController {
  constructor(private readonly commands: CommandBus) {}

{{#if validation.classValidator}}
  async handle(request: HttpRequest<{ params: GrantDelegationParams; body: GrantDelegationBody }>): Promise<{{#if schemas.shared}}Accepted{{/if}}{{#if schemas.perRoute}}GrantDelegationAccepted{{/if}}> {
{{/if}}
{{#if validation.zod}}
  async handle(request: HttpRequest<{ params: Infer<typeof params>; body: Infer<typeof body> }>): Promise<{{#if schemas.shared}}Accepted{{/if}}{{#if schemas.perRoute}}Infer<typeof accepted>{{/if}}> {
{{/if}}
    const id = await this.commands.execute(new GrantDelegationCommand(request.actor, request.params.organisationId, termsOf(request.body)));

    return { id };
  }
}

{{#if validation.classValidator}}
function termsOf({ delegateId, rights, startsAt, endsAt }: GrantDelegationBody): GrantDelegationCommand['terms'] {
  return { delegateId, rights, startsAt: new Date(startsAt), endsAt: new Date(endsAt) };
}
{{/if}}
{{#if validation.zod}}
function termsOf({ delegateId, rights, startsAt, endsAt }: Infer<typeof body>): GrantDelegationCommand['terms'] {
  return { delegateId, rights, startsAt: new Date(startsAt), endsAt: new Date(endsAt) };
}
{{/if}}
