import { describe, expect, it } from '{{tests.module}}';
{{#if routes.nest}}
import { nestControllerRoutes } from '@ddd-ts-kit/http/nest';
{{/if}}
import { DuplicateHandlerError, type Command, type MessageType, type Query } from '@ddd-ts-kit/kernel';
{{#if routes.nest}}
import { classSchema } from '@ddd-ts-kit/validation/class-validator';
{{/if}}
import { {{context.camel}}Module } from '{{alias.context}}/{{context.kebab}}.module{{alias.ext}}';
import { AcceptInvitationCommand } from '{{alias.context}}/application/commands/accept-invitation/accept-invitation.command{{alias.ext}}';
import { ChangeMemberRoleCommand } from '{{alias.context}}/application/commands/change-member-role/change-member-role.command{{alias.ext}}';
import { DeactivateAccountCommand } from '{{alias.context}}/application/commands/deactivate-account/deactivate-account.command{{alias.ext}}';
import { DeclineInvitationCommand } from '{{alias.context}}/application/commands/decline-invitation/decline-invitation.command{{alias.ext}}';
import { GrantDelegationCommand } from '{{alias.context}}/application/commands/grant-delegation/grant-delegation.command{{alias.ext}}';
import { InviteMemberCommand } from '{{alias.context}}/application/commands/invite-member/invite-member.command{{alias.ext}}';
import { OpenOrganisationCommand } from '{{alias.context}}/application/commands/open-organisation/open-organisation.command{{alias.ext}}';
import { ProvisionAccountCommand } from '{{alias.context}}/application/commands/provision-account/provision-account.command{{alias.ext}}';
import { RemoveMemberCommand } from '{{alias.context}}/application/commands/remove-member/remove-member.command{{alias.ext}}';
import { RevokeDelegationCommand } from '{{alias.context}}/application/commands/revoke-delegation/revoke-delegation.command{{alias.ext}}';
import { RevokeInvitationCommand } from '{{alias.context}}/application/commands/revoke-invitation/revoke-invitation.command{{alias.ext}}';
import { SearchMembersQuery } from '{{alias.context}}/application/queries/search-members/search-members.query{{alias.ext}}';
import { createPlatform } from '{{alias.platform}}/composition/create-platform{{alias.ext}}';
import { inertPersistence } from '{{alias.platform}}/database/inert-persistence{{alias.ext}}';
import { inProcessEvents } from '{{alias.platform}}/events/in-process-events{{alias.ext}}';

/**
 * The module of the context as the application composes it, on the platform: the specs of the use
 * cases run on the world of the context, this one holds the module to them, so that a use case
 * the module forgets, or a route it does not mount, fails here.
 */
const platform = createPlatform(inertPersistence(), { events: inProcessEvents() });
const wiring = {{context.camel}}Module(platform);

const USE_CASES = [
  command(AcceptInvitationCommand),
  command(ChangeMemberRoleCommand),
  command(DeactivateAccountCommand),
  command(DeclineInvitationCommand),
  command(GrantDelegationCommand),
  command(InviteMemberCommand),
  command(OpenOrganisationCommand),
  command(ProvisionAccountCommand),
  command(RemoveMemberCommand),
  command(RevokeDelegationCommand),
  command(RevokeInvitationCommand),
  query(SearchMembersQuery),
];

describe('The module of {{context.kebab}}', () => {
  it.each(USE_CASES)('gives %s its handler', (_name, handled) => {
    expect(handled).toBe(true);
  });

  it('requires a permission of every use case of the context, and of nothing else', () => {
    const required = wiring.useCases.map(({ type }) => type.name).toSorted();

    expect(required).toEqual(USE_CASES.map(([name]) => name).toSorted());
  });

  it('mounts one route per use case of the context', () => {
{{#unless routes.nest}}
    const mounted = wiring.routes.map(({ method, path }) => `${method} ${path}`).toSorted();
{{/unless}}
{{#if routes.nest}}
    // The Nest controllers of the context, served by the kit: their routes as the application mounts them.
    const routes = nestControllerRoutes(wiring.controllers, { schemaOfClass: (dto) => classSchema(dto) });
    const mounted = routes.map(({ method, path }) => `${method} ${path}`).toSorted();
{{/if}}

    expect(mounted).toEqual([
      'DELETE /organisations/:organisationId/delegations/:delegationId',
      'DELETE /organisations/:organisationId/invitations/:invitationId',
      'DELETE /organisations/:organisationId/members/:accountId',
      'GET /organisations/:organisationId/members',
      'POST /accounts/me/deactivation',
      'POST /invitations/acceptance',
      'POST /invitations/declination',
      'POST /organisations',
      'POST /organisations/:organisationId/delegations',
      'POST /organisations/:organisationId/invitations',
      'PUT /accounts/me',
      'PUT /organisations/:organisationId/members/:accountId/role',
    ]);
  });
});

function command<C extends Command<unknown>>(type: MessageType<C>) {
  return [type.name, alreadyHandled(() => platform.commands.register(type, { execute: never }))] as const;
}

function query<Q extends Query<unknown>>(type: MessageType<Q>) {
  return [type.name, alreadyHandled(() => platform.queries.register(type, { execute: never }))] as const;
}

/** Whether the bus already held a handler of the message: a second one is then refused as a duplicate. */
function alreadyHandled(register: () => unknown): boolean {
  try {
    register();

    return false;
  } catch (error) {
    return error instanceof DuplicateHandlerError;
  }
}

function never(): Promise<never> {
  return Promise.reject(new Error('A second handler is never run'));
}
