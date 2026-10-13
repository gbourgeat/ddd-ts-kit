{{#if validation.classValidator}}
import { Controller, type HttpRequest } from '@ddd-ts-kit/http';
import type { CommandBus } from '@ddd-ts-kit/kernel';
import { classSchema } from '@ddd-ts-kit/validation/class-validator';
import { RevokeDelegationCommand } from '{{alias.context}}/application/commands/revoke-delegation/revoke-delegation.command{{alias.ext}}';
import { RevokeDelegationParams } from '{{alias.context}}/presentation/http/organisations/revoke-delegation/revoke-delegation.params{{alias.ext}}';
import { RevokeDelegationAccepted } from '{{alias.context}}/presentation/http/organisations/revoke-delegation/revoke-delegation.accepted{{alias.ext}}';
import { OrganisationsRoutes } from '{{alias.context}}/presentation/http/organisations.routes{{alias.ext}}';
{{/if}}
{{#if validation.zod}}
import { z } from 'zod';
import { Controller, type HttpRequest } from '@ddd-ts-kit/http';
import type { CommandBus } from '@ddd-ts-kit/kernel';
import type { Infer } from '@ddd-ts-kit/validation';
import { zodSchema } from '@ddd-ts-kit/validation/zod';
import { RevokeDelegationCommand } from '{{alias.context}}/application/commands/revoke-delegation/revoke-delegation.command{{alias.ext}}';
import { OrganisationsRoutes } from '{{alias.context}}/presentation/http/organisations.routes{{alias.ext}}';
{{/if}}

{{#if validation.classValidator}}
const params = classSchema(RevokeDelegationParams);
const accepted = classSchema(RevokeDelegationAccepted);
{{/if}}
{{#if validation.zod}}
const params = zodSchema(
  z.object({
    organisationId: z.string().min(1),
    delegationId: z.string().min(1),
  }),
);

const accepted = zodSchema(z.object({ id: z.string() }), { io: 'output' });
{{/if}}

@Controller({
  group: OrganisationsRoutes,
  method: 'DELETE',
  path: '/:organisationId/delegations/:delegationId',
  summary: 'Revoke a delegation',
  params,
  response: { status: 200, description: 'Revoked; the body carries its identifier.', body: accepted },
  errors: ['DELEGATION_NOT_FOUND', 'DELEGATION_NOT_ACTIVE'],
})
export class RevokeDelegationController {
  constructor(private readonly commands: CommandBus) {}

{{#if validation.classValidator}}
  async handle(request: HttpRequest<{ params: RevokeDelegationParams }>): Promise<RevokeDelegationAccepted> {
{{/if}}
{{#if validation.zod}}
  async handle(request: HttpRequest<{ params: Infer<typeof params> }>): Promise<Infer<typeof accepted>> {
{{/if}}
    const id = await this.commands.execute(new RevokeDelegationCommand(request.actor, request.params.organisationId, request.params.delegationId));

    return { id };
  }
}
