import type { UseCaseDeclaration } from '@ddd-ts-kit/auth';
{{#if routes.nest}}
import type { Type } from '@nestjs/common';
import { {{context.camel}}Controllers } from '{{alias.context}}/{{context.kebab}}.controllers{{alias.ext}}';
{{/if}}
import type { Route } from '@ddd-ts-kit/http';
import type { Actored, DomainEvent, Message } from '@ddd-ts-kit/kernel';
import type { Platform } from '{{alias.platform}}/composition/platform{{alias.ext}}';
import type { IdentityProviderAdmin } from '{{alias.context}}/application/ports/identity-provider-admin.port{{alias.ext}}';
// ddd-ts-kit:imports
import { requires, type RequirementOptions } from '@ddd-ts-kit/auth';
import { on, subscribeAll } from '@ddd-ts-kit/events';
{{#unless routes.nest}}
import { controllerRoutes } from '@ddd-ts-kit/http';
{{/unless}}
import { {{context.camel}}Permissions } from '{{alias.context}}/{{context.kebab}}.permissions{{alias.ext}}';
import { {{preset.adapter.pascal}}AccountRepository } from '{{alias.context}}/infrastructure/persistence/{{preset.adapter.kebab}}-account.repository{{alias.ext}}';
import { {{preset.adapter.pascal}}OrganisationRepository } from '{{alias.context}}/infrastructure/persistence/{{preset.adapter.kebab}}-organisation.repository{{alias.ext}}';
import { {{preset.adapter.pascal}}MemberRepository } from '{{alias.context}}/infrastructure/persistence/{{preset.adapter.kebab}}-member.repository{{alias.ext}}';
import { {{preset.adapter.pascal}}InvitationRepository } from '{{alias.context}}/infrastructure/persistence/{{preset.adapter.kebab}}-invitation.repository{{alias.ext}}';
import { {{preset.adapter.pascal}}DelegationRepository } from '{{alias.context}}/infrastructure/persistence/{{preset.adapter.kebab}}-delegation.repository{{alias.ext}}';
import { {{preset.adapter.pascal}}SearchMembersReader } from '{{alias.context}}/infrastructure/persistence/{{preset.adapter.kebab}}-search-members-reader.repository{{alias.ext}}';
import { CryptoInvitationTokens } from '{{alias.context}}/infrastructure/external/crypto-invitation-tokens.adapter{{alias.ext}}';
import { EnvironmentIdentityProviderConnection } from '{{alias.context}}/infrastructure/external/environment-identity-provider-connection.adapter{{alias.ext}}';
import { KeycloakIdentityProviderAdmin } from '{{alias.context}}/infrastructure/external/keycloak-identity-provider-admin.adapter{{alias.ext}}';
import { AcceptInvitationCommand } from '{{alias.context}}/application/commands/accept-invitation/accept-invitation.command{{alias.ext}}';
import { AcceptInvitationHandler } from '{{alias.context}}/application/commands/accept-invitation/accept-invitation.handler{{alias.ext}}';
import { ChangeMemberRoleCommand } from '{{alias.context}}/application/commands/change-member-role/change-member-role.command{{alias.ext}}';
import { ChangeMemberRoleHandler } from '{{alias.context}}/application/commands/change-member-role/change-member-role.handler{{alias.ext}}';
import { DeactivateAccountCommand } from '{{alias.context}}/application/commands/deactivate-account/deactivate-account.command{{alias.ext}}';
import { DeactivateAccountHandler } from '{{alias.context}}/application/commands/deactivate-account/deactivate-account.handler{{alias.ext}}';
import { DeclineInvitationCommand } from '{{alias.context}}/application/commands/decline-invitation/decline-invitation.command{{alias.ext}}';
import { DeclineInvitationHandler } from '{{alias.context}}/application/commands/decline-invitation/decline-invitation.handler{{alias.ext}}';
import { GrantDelegationCommand } from '{{alias.context}}/application/commands/grant-delegation/grant-delegation.command{{alias.ext}}';
import { GrantDelegationHandler } from '{{alias.context}}/application/commands/grant-delegation/grant-delegation.handler{{alias.ext}}';
import { InviteMemberCommand } from '{{alias.context}}/application/commands/invite-member/invite-member.command{{alias.ext}}';
import { InviteMemberHandler } from '{{alias.context}}/application/commands/invite-member/invite-member.handler{{alias.ext}}';
import { OpenOrganisationCommand } from '{{alias.context}}/application/commands/open-organisation/open-organisation.command{{alias.ext}}';
import { OpenOrganisationHandler } from '{{alias.context}}/application/commands/open-organisation/open-organisation.handler{{alias.ext}}';
import { ProvisionAccountCommand } from '{{alias.context}}/application/commands/provision-account/provision-account.command{{alias.ext}}';
import { ProvisionAccountHandler } from '{{alias.context}}/application/commands/provision-account/provision-account.handler{{alias.ext}}';
import { RemoveMemberCommand } from '{{alias.context}}/application/commands/remove-member/remove-member.command{{alias.ext}}';
import { RemoveMemberHandler } from '{{alias.context}}/application/commands/remove-member/remove-member.handler{{alias.ext}}';
import { RevokeDelegationCommand } from '{{alias.context}}/application/commands/revoke-delegation/revoke-delegation.command{{alias.ext}}';
import { RevokeDelegationHandler } from '{{alias.context}}/application/commands/revoke-delegation/revoke-delegation.handler{{alias.ext}}';
import { RevokeInvitationCommand } from '{{alias.context}}/application/commands/revoke-invitation/revoke-invitation.command{{alias.ext}}';
import { RevokeInvitationHandler } from '{{alias.context}}/application/commands/revoke-invitation/revoke-invitation.handler{{alias.ext}}';
import { SearchMembersQuery } from '{{alias.context}}/application/queries/search-members/search-members.query{{alias.ext}}';
import { SearchMembersHandler } from '{{alias.context}}/application/queries/search-members/search-members.handler{{alias.ext}}';
import { AccountDeactivatedIntegrationHandler } from '{{alias.context}}/application/integration/handlers/account-deactivated.integration-handler{{alias.ext}}';
import { accountDeactivatedV1 } from '{{alias.context}}/published-language/account-deactivated.v1.integration-event{{alias.ext}}';
import { MemberJoinedIntegrationHandler } from '{{alias.context}}/application/integration/handlers/member-joined.integration-handler{{alias.ext}}';
import { memberJoinedV1 } from '{{alias.context}}/published-language/member-joined.v1.integration-event{{alias.ext}}';
import { MemberRemovedIntegrationHandler } from '{{alias.context}}/application/integration/handlers/member-removed.integration-handler{{alias.ext}}';
import { memberRemovedV1 } from '{{alias.context}}/published-language/member-removed.v1.integration-event{{alias.ext}}';
import { OrganisationOpenedIntegrationHandler } from '{{alias.context}}/application/integration/handlers/organisation-opened.integration-handler{{alias.ext}}';
import { organisationOpenedV1 } from '{{alias.context}}/published-language/organisation-opened.v1.integration-event{{alias.ext}}';
{{#unless routes.nest}}
import { DeactivateAccountController } from '{{alias.context}}/presentation/http/accounts/deactivate-account/deactivate-account.controller{{alias.ext}}';
import { ProvisionAccountController } from '{{alias.context}}/presentation/http/accounts/provision-account/provision-account.controller{{alias.ext}}';
import { AcceptInvitationController } from '{{alias.context}}/presentation/http/invitations/accept-invitation/accept-invitation.controller{{alias.ext}}';
import { DeclineInvitationController } from '{{alias.context}}/presentation/http/invitations/decline-invitation/decline-invitation.controller{{alias.ext}}';
import { ChangeMemberRoleController } from '{{alias.context}}/presentation/http/organisations/change-member-role/change-member-role.controller{{alias.ext}}';
import { GrantDelegationController } from '{{alias.context}}/presentation/http/organisations/grant-delegation/grant-delegation.controller{{alias.ext}}';
import { InviteMemberController } from '{{alias.context}}/presentation/http/organisations/invite-member/invite-member.controller{{alias.ext}}';
import { OpenOrganisationController } from '{{alias.context}}/presentation/http/organisations/open-organisation/open-organisation.controller{{alias.ext}}';
import { RemoveMemberController } from '{{alias.context}}/presentation/http/organisations/remove-member/remove-member.controller{{alias.ext}}';
import { RevokeDelegationController } from '{{alias.context}}/presentation/http/organisations/revoke-delegation/revoke-delegation.controller{{alias.ext}}';
import { RevokeInvitationController } from '{{alias.context}}/presentation/http/organisations/revoke-invitation/revoke-invitation.controller{{alias.ext}}';
import { SearchMembersController } from '{{alias.context}}/presentation/http/organisations/search-members/search-members.controller{{alias.ext}}';
{{/unless}}
import { AccountDeactivatedPublisher } from '{{alias.context}}/application/integration/publishers/account-deactivated.publisher{{alias.ext}}';
import { AccountDeactivated } from '{{alias.context}}/domain/events/account-deactivated.event{{alias.ext}}';
import { OrganisationOpenedPublisher } from '{{alias.context}}/application/integration/publishers/organisation-opened.publisher{{alias.ext}}';
import { OrganisationOpened } from '{{alias.context}}/domain/events/organisation-opened.event{{alias.ext}}';
import { MemberJoinedPublisher } from '{{alias.context}}/application/integration/publishers/member-joined.publisher{{alias.ext}}';
import { MemberJoined } from '{{alias.context}}/domain/events/member-joined.event{{alias.ext}}';
import { MemberRoleChangedPublisher } from '{{alias.context}}/application/integration/publishers/member-role-changed.publisher{{alias.ext}}';
import { MemberRoleChanged } from '{{alias.context}}/domain/events/member-role-changed.event{{alias.ext}}';
import { MemberRemovedPublisher } from '{{alias.context}}/application/integration/publishers/member-removed.publisher{{alias.ext}}';
import { MemberRemoved } from '{{alias.context}}/domain/events/member-removed.event{{alias.ext}}';
import { DelegationGrantedPublisher } from '{{alias.context}}/application/integration/publishers/delegation-granted.publisher{{alias.ext}}';
import { DelegationGranted } from '{{alias.context}}/domain/events/delegation-granted.event{{alias.ext}}';
import { DelegationRevokedPublisher } from '{{alias.context}}/application/integration/publishers/delegation-revoked.publisher{{alias.ext}}';
import { DelegationRevoked } from '{{alias.context}}/domain/events/delegation-revoked.event{{alias.ext}}';
// /ddd-ts-kit:imports

export interface {{context.pascal}}Wiring {
  readonly name: string;
  readonly useCases: readonly UseCaseDeclaration[];
  readonly routes: readonly Route[];
  {{#if routes.nest}}
  /** Its Nest controllers, listed by the generated `{{context.kebab}}.controllers.ts`: Nest builds them, the kit serves their methods. */
  readonly controllers: readonly Type<unknown>[];
  {{/if}}
}

/** Every use case of the context is asked of the context as a whole: inside an organisation, its policies decide. */
const IN_THE_CONTEXT: RequirementOptions<Message & Actored> = { resource: () => ({ type: 'context', id: '{{context.kebab}}' }) };

/** The adapters of outside systems a test run replaces by their fakes (`test/e2e/support/start-application.ts`); left out, the real ones. */
export interface OutsideSystems {
  readonly identityProvider?: IdentityProviderAdmin;
}

/**
 * What the declarations of the context say in the declared style: its adapters, its use cases,
 * the facts it publishes, the consumers that keep the identity provider in line, and its routes.
 */
export function {{context.camel}}Module(platform: Platform, outside: OutsideSystems = {}): {{context.pascal}}Wiring {
  const adapters = adaptersOf(platform, outside);

  registerAccountsAndOrganisations(platform, adapters);
  registerInvitations(platform, adapters);
  registerMembersAndDelegations(platform, adapters);
  publishTheFacts(platform);
  keepTheProviderInLine(platform, adapters);
  // ddd-ts-kit:registrations
  // /ddd-ts-kit:registrations

  return {
    name: '{{context.kebab}}',
    useCases: [
      // ddd-ts-kit:authorization
      requires(AcceptInvitationCommand, {{context.camel}}Permissions['invitation.accept'], IN_THE_CONTEXT),
      requires(ChangeMemberRoleCommand, {{context.camel}}Permissions['member.change-role'], IN_THE_CONTEXT),
      requires(DeactivateAccountCommand, {{context.camel}}Permissions['account.deactivate'], IN_THE_CONTEXT),
      requires(DeclineInvitationCommand, {{context.camel}}Permissions['invitation.decline'], IN_THE_CONTEXT),
      requires(GrantDelegationCommand, {{context.camel}}Permissions['delegation.grant'], IN_THE_CONTEXT),
      requires(InviteMemberCommand, {{context.camel}}Permissions['member.invite'], IN_THE_CONTEXT),
      requires(OpenOrganisationCommand, {{context.camel}}Permissions['organisation.open'], IN_THE_CONTEXT),
      requires(ProvisionAccountCommand, {{context.camel}}Permissions['account.provision'], IN_THE_CONTEXT),
      requires(RemoveMemberCommand, {{context.camel}}Permissions['member.remove'], IN_THE_CONTEXT),
      requires(RevokeDelegationCommand, {{context.camel}}Permissions['delegation.revoke'], IN_THE_CONTEXT),
      requires(RevokeInvitationCommand, {{context.camel}}Permissions['invitation.revoke'], IN_THE_CONTEXT),
      requires(SearchMembersQuery, {{context.camel}}Permissions['member.search'], IN_THE_CONTEXT),
      // /ddd-ts-kit:authorization
    ],
    routes: [
      // ddd-ts-kit:routes
      {{#unless routes.nest}}
      ...controllerRoutes([new DeactivateAccountController(platform.commands)]),
      ...controllerRoutes([new ProvisionAccountController(platform.commands)]),
      ...controllerRoutes([new AcceptInvitationController(platform.commands)]),
      ...controllerRoutes([new DeclineInvitationController(platform.commands)]),
      ...controllerRoutes([new ChangeMemberRoleController(platform.commands)]),
      ...controllerRoutes([new GrantDelegationController(platform.commands)]),
      ...controllerRoutes([new InviteMemberController(platform.commands)]),
      ...controllerRoutes([new OpenOrganisationController(platform.commands)]),
      ...controllerRoutes([new RemoveMemberController(platform.commands)]),
      ...controllerRoutes([new RevokeDelegationController(platform.commands)]),
      ...controllerRoutes([new RevokeInvitationController(platform.commands)]),
      ...controllerRoutes([new SearchMembersController(platform.queries)]),
      {{/unless}}
      // /ddd-ts-kit:routes
    ],
    {{#if routes.nest}}
    controllers: {{context.camel}}Controllers,
    {{/if}}
  };
}

/** The adapters of the ports of the context, each observed and protected by the platform. */
function adaptersOf(platform: Platform, outside: OutsideSystems) {
  const { persistence, scope, clock } = platform;
  const as = (kind: 'repository' | 'external', token: string) => ({ kind, context: '{{context.kebab}}', token });
  const connection = new EnvironmentIdentityProviderConnection();

  return {
    accounts: platform.adapter(new {{preset.adapter.pascal}}AccountRepository(persistence.database, scope, clock), as('repository', 'AccountRepository')),
    organisations: platform.adapter(new {{preset.adapter.pascal}}OrganisationRepository(persistence.database, scope, clock), as('repository', 'OrganisationRepository')),
    members: platform.adapter(new {{preset.adapter.pascal}}MemberRepository(persistence.database, scope, clock), as('repository', 'MemberRepository')),
    invitations: platform.adapter(new {{preset.adapter.pascal}}InvitationRepository(persistence.database, scope, clock), as('repository', 'InvitationRepository')),
    delegations: platform.adapter(new {{preset.adapter.pascal}}DelegationRepository(persistence.database, scope, clock), as('repository', 'DelegationRepository')),
    reader: platform.adapter(new {{preset.adapter.pascal}}SearchMembersReader(persistence.database), as('repository', 'SearchMembersReader')),
    tokens: platform.adapter(new CryptoInvitationTokens(), as('external', 'InvitationTokens')),
    identityProvider: platform.adapter(outside.identityProvider ?? new KeycloakIdentityProviderAdmin(connection), as('external', 'IdentityProviderAdmin')),
    access: platform.access,
  };
}

type Adapters = ReturnType<typeof adaptersOf>;

function registerAccountsAndOrganisations({ commands, ids, clock }: Platform, adapters: Adapters): void {
  const { accounts, organisations, members, delegations } = adapters;
  const own = { context: '{{context.kebab}}' };

  commands.register(ProvisionAccountCommand, new ProvisionAccountHandler(accounts, clock), own);
  commands.register(DeactivateAccountCommand, new DeactivateAccountHandler(accounts, organisations, members, delegations, clock), own);
  commands.register(OpenOrganisationCommand, new OpenOrganisationHandler(organisations, members, accounts, ids, clock), own);
}

function registerInvitations({ commands, ids, clock }: Platform, adapters: Adapters): void {
  const { accounts, members, invitations, delegations, tokens, access } = adapters;
  const own = { context: '{{context.kebab}}' };

  commands.register(InviteMemberCommand, new InviteMemberHandler(invitations, members, delegations, tokens, access, ids, clock), own);
  commands.register(AcceptInvitationCommand, new AcceptInvitationHandler(invitations, members, accounts, tokens, ids, clock), own);
  commands.register(DeclineInvitationCommand, new DeclineInvitationHandler(invitations, accounts, tokens, clock), own);
  commands.register(RevokeInvitationCommand, new RevokeInvitationHandler(invitations, members, delegations, access, clock), own);
}

function registerMembersAndDelegations({ commands, queries, ids, clock }: Platform, adapters: Adapters): void {
  const { organisations, members, delegations, reader, access } = adapters;
  const own = { context: '{{context.kebab}}' };

  commands.register(ChangeMemberRoleCommand, new ChangeMemberRoleHandler(organisations, members, delegations, access, clock), own);
  commands.register(RemoveMemberCommand, new RemoveMemberHandler(organisations, members, delegations, access, clock), own);
  commands.register(GrantDelegationCommand, new GrantDelegationHandler(delegations, members, access, ids, clock), own);
  commands.register(RevokeDelegationCommand, new RevokeDelegationHandler(delegations, members, access, clock), own);
  queries.register(SearchMembersQuery, new SearchMembersHandler(reader, members, delegations, access, clock), own);
}

/** The facts the context announces, published as the integration events of its published language through the outbox. */
function publishTheFacts(platform: Platform): void {
  const { publisher, ids } = platform;

  announce(platform, AccountDeactivated, new AccountDeactivatedPublisher(publisher, ids));
  announce(platform, OrganisationOpened, new OrganisationOpenedPublisher(publisher, ids));
  announce(platform, MemberJoined, new MemberJoinedPublisher(publisher, ids));
  announce(platform, MemberRoleChanged, new MemberRoleChangedPublisher(publisher, ids));
  announce(platform, MemberRemoved, new MemberRemovedPublisher(publisher, ids));
  announce(platform, DelegationGranted, new DelegationGrantedPublisher(publisher, ids));
  announce(platform, DelegationRevoked, new DelegationRevokedPublisher(publisher, ids));
}

/** Hands the events of one class to their publisher, observed by the platform as a handler of the context. */
function announce<Fact extends DomainEvent>(
  platform: Platform,
  fact: (abstract new (...args: never[]) => Fact) & { readonly eventName: string },
  publisher: { handle(event: Fact): Promise<void> },
): void {
  const observed = platform.adapter(publisher, { kind: 'domain-event-handler', context: '{{context.kebab}}' });

  platform.domainEvents.on(fact.eventName, async (event) => {
    if (event instanceof fact) {
      await observed.handle(event);
    }
  });
}

/** The consumers that bring the identity provider in line with what the context publishes, each event handled once. */
function keepTheProviderInLine(platform: Platform, { members, identityProvider }: Adapters): void {
  const { processedEvents: processed, unitOfWork } = platform.persistence;
  const { scope } = platform;
  const accountDeactivatedIntegrationHandler = new AccountDeactivatedIntegrationHandler(identityProvider);
  const memberJoinedIntegrationHandler = new MemberJoinedIntegrationHandler(members, identityProvider);
  const memberRemovedIntegrationHandler = new MemberRemovedIntegrationHandler(members, identityProvider);
  const organisationOpenedIntegrationHandler = new OrganisationOpenedIntegrationHandler(identityProvider);

  subscribeAll(platform.subscriber, [
    on(accountDeactivatedV1, (event) => accountDeactivatedIntegrationHandler.handle(event), {
      consumer: '{{context.kebab}}.provider-disables-account',
      processed,
      unitOfWork,
      scope,
    }),
    on(memberJoinedV1, (event) => memberJoinedIntegrationHandler.handle(event), {
      consumer: '{{context.kebab}}.provider-follows-joined-member',
      processed,
      unitOfWork,
      scope,
    }),
    on(memberRemovedV1, (event) => memberRemovedIntegrationHandler.handle(event), {
      consumer: '{{context.kebab}}.provider-follows-removed-member',
      processed,
      unitOfWork,
      scope,
    }),
    on(organisationOpenedV1, (event) => organisationOpenedIntegrationHandler.handle(event), {
      consumer: '{{context.kebab}}.provider-opens-organisation',
      processed,
      unitOfWork,
      scope,
    }),
  ]);
}
