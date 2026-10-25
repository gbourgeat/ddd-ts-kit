import { Controller, Delete, Inject, Param } from '@nestjs/common';
{{#if schemas.shared}}
import type { Accepted } from '@ddd-ts-kit/http';
{{/if}}
import { CurrentActor, KitRoute, KitRoutes } from '@ddd-ts-kit/http/nest';
import { CommandBus, type Actor } from '@ddd-ts-kit/kernel';
import { RevokeDelegationCommand } from '{{alias.context}}/application/commands/revoke-delegation/revoke-delegation.command{{alias.ext}}';
import { RevokeDelegationParams } from '{{alias.context}}/presentation/http/organisations/revoke-delegation/revoke-delegation.params{{alias.ext}}';
{{#if schemas.perRoute}}
import { RevokeDelegationAccepted } from '{{alias.context}}/presentation/http/organisations/revoke-delegation/revoke-delegation.accepted{{alias.ext}}';
{{/if}}
import { OrganisationsRoutes } from '{{alias.context}}/presentation/http/organisations.routes{{alias.ext}}';

/** Built by Nest with the bus it injects, served by the kit: its parts and its answer are read from its signature. */
@Controller()
@KitRoutes({ group: OrganisationsRoutes })
export class RevokeDelegationController {
  constructor(@Inject(CommandBus) private readonly commands: CommandBus) {}

  @Delete(':organisationId/delegations/:delegationId')
  @KitRoute({
    summary: 'Revoke a delegation',
    response: { description: 'Revoked; the body carries its identifier.' },
    errors: ['DELEGATION_NOT_FOUND', 'DELEGATION_NOT_ACTIVE'],
  })
  async revokeDelegation(@Param() params: RevokeDelegationParams, @CurrentActor() actor: Actor): Promise<{{#if schemas.shared}}Accepted{{/if}}{{#if schemas.perRoute}}RevokeDelegationAccepted{{/if}}> {
    const id = await this.commands.execute(new RevokeDelegationCommand(actor, params.organisationId, params.delegationId));

    return { id };
  }
}
