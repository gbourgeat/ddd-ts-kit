{{#if validation.classValidator}}
{{#if schemas.shared}}
import { acceptedSchema, Controller, type Accepted, type HttpRequest } from '@ddd-ts-kit/http';
{{/if}}
{{#if schemas.perRoute}}
import { Controller, type HttpRequest } from '@ddd-ts-kit/http';
{{/if}}
import type { CommandBus } from '@ddd-ts-kit/kernel';
import { classSchema } from '@ddd-ts-kit/validation/class-validator';
import { RevokeDelegationCommand } from '{{alias.context}}/application/commands/revoke-delegation/revoke-delegation.command{{alias.ext}}';
import { RevokeDelegationParams } from '{{alias.context}}/presentation/http/organisations/revoke-delegation/revoke-delegation.params{{alias.ext}}';
{{#if schemas.perRoute}}
import { RevokeDelegationAccepted } from '{{alias.context}}/presentation/http/organisations/revoke-delegation/revoke-delegation.accepted{{alias.ext}}';
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
import { RevokeDelegationCommand } from '{{alias.context}}/application/commands/revoke-delegation/revoke-delegation.command{{alias.ext}}';
import { OrganisationsRoutes } from '{{alias.context}}/presentation/http/organisations.routes{{alias.ext}}';
{{/if}}

{{#if validation.classValidator}}
const params = classSchema(RevokeDelegationParams);
{{#if schemas.perRoute}}
const accepted = classSchema(RevokeDelegationAccepted);
{{/if}}
{{/if}}
{{#if validation.zod}}
const params = zodSchema(
  z.object({
    organisationId: z.string().min(1),
    delegationId: z.string().min(1),
  }),
);

{{#if schemas.perRoute}}
const accepted = zodSchema(z.object({ id: z.string() }), { io: 'output' });
{{/if}}
{{/if}}

@Controller({
  group: OrganisationsRoutes,
  method: 'DELETE',
  path: '/:organisationId/delegations/:delegationId',
  summary: 'Revoke a delegation',
  params,
  response: { status: 200, description: 'Revoked; the body carries its identifier.', body: {{#if schemas.shared}}acceptedSchema{{/if}}{{#if schemas.perRoute}}accepted{{/if}} },
  errors: ['DELEGATION_NOT_FOUND', 'DELEGATION_NOT_ACTIVE'],
})
export class RevokeDelegationController {
  constructor(private readonly commands: CommandBus) {}

{{#if validation.classValidator}}
  async handle(request: HttpRequest<{ params: RevokeDelegationParams }>): Promise<{{#if schemas.shared}}Accepted{{/if}}{{#if schemas.perRoute}}RevokeDelegationAccepted{{/if}}> {
{{/if}}
{{#if validation.zod}}
  async handle(request: HttpRequest<{ params: Infer<typeof params> }>): Promise<{{#if schemas.shared}}Accepted{{/if}}{{#if schemas.perRoute}}Infer<typeof accepted>{{/if}}> {
{{/if}}
    const id = await this.commands.execute(new RevokeDelegationCommand(request.actor, request.params.organisationId, request.params.delegationId));

    return { id };
  }
}
