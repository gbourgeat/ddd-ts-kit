import {
  AuthorizationMap,
  PolicyAccess,
  RoleBasedAuthorizer,
  authorizationMiddleware,
  requires,
  type Access,
} from '@ddd-ts-kit/auth';
import { anActor } from '@ddd-ts-kit/auth/testing';
import { on, subscribeAll } from '@ddd-ts-kit/events';
import { InMemoryProcessedEventStore, type Actor } from '@ddd-ts-kit/kernel';
import { createTestBuses, type TestBuses } from '@ddd-ts-kit/testing';
import { {{context.camel}}Permissions } from '{{alias.context}}/{{context.kebab}}.permissions{{alias.ext}}';
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
import { ChangeMemberRolesPolicy } from '{{alias.context}}/application/authorization/change-member-roles.policy{{alias.ext}}';
import { GrantDelegationsPolicy } from '{{alias.context}}/application/authorization/grant-delegations.policy{{alias.ext}}';
import { InviteMembersPolicy } from '{{alias.context}}/application/authorization/invite-members.policy{{alias.ext}}';
import { ReadMembersPolicy } from '{{alias.context}}/application/authorization/read-members.policy{{alias.ext}}';
import { RemoveMembersPolicy } from '{{alias.context}}/application/authorization/remove-members.policy{{alias.ext}}';
import { RevokeDelegationsPolicy } from '{{alias.context}}/application/authorization/revoke-delegations.policy{{alias.ext}}';
import { RevokeInvitationsPolicy } from '{{alias.context}}/application/authorization/revoke-invitations.policy{{alias.ext}}';
import { FakeAccountRepository } from '{{alias.context}}/test/fakes/account.repository.fake{{alias.ext}}';
import { FakeDelegationRepository } from '{{alias.context}}/test/fakes/delegation.repository.fake{{alias.ext}}';
import { FakeIdentityProviderAdmin } from '{{alias.context}}/test/fakes/identity-provider-admin.fake{{alias.ext}}';
import { FakeInvitationRepository } from '{{alias.context}}/test/fakes/invitation.repository.fake{{alias.ext}}';
import { FakeInvitationTokens } from '{{alias.context}}/test/fakes/invitation-tokens.fake{{alias.ext}}';
import { FakeMemberRepository } from '{{alias.context}}/test/fakes/member.repository.fake{{alias.ext}}';
import { FakeOrganisationRepository } from '{{alias.context}}/test/fakes/organisation.repository.fake{{alias.ext}}';
import { FakeSearchMembersReader } from '{{alias.context}}/test/fakes/search-members-reader.fake{{alias.ext}}';

/** The role every signed-in person holds in these specs: the platform grants it the permissions of the context. */
const PERSON = 'person';

const authorizer = new RoleBasedAuthorizer({ roles: { [PERSON]: Object.values({{context.camel}}Permissions) } });

/** What each use case of the context requires, as `{{context.kebab}}.module.ts` lists it. */
const people = authorizationMiddleware({
  authorizer,
  map: AuthorizationMap.of(
    requires(AcceptInvitationCommand, {{context.camel}}Permissions['invitation.accept'], {
      resource: () => ({ type: 'context', id: '{{context.kebab}}' }),
    }),
    requires(ChangeMemberRoleCommand, {{context.camel}}Permissions['member.change-role'], {
      resource: () => ({ type: 'context', id: '{{context.kebab}}' }),
    }),
    requires(DeactivateAccountCommand, {{context.camel}}Permissions['account.deactivate'], {
      resource: () => ({ type: 'context', id: '{{context.kebab}}' }),
    }),
    requires(DeclineInvitationCommand, {{context.camel}}Permissions['invitation.decline'], {
      resource: () => ({ type: 'context', id: '{{context.kebab}}' }),
    }),
    requires(GrantDelegationCommand, {{context.camel}}Permissions['delegation.grant'], {
      resource: () => ({ type: 'context', id: '{{context.kebab}}' }),
    }),
    requires(InviteMemberCommand, {{context.camel}}Permissions['member.invite'], {
      resource: () => ({ type: 'context', id: '{{context.kebab}}' }),
    }),
    requires(OpenOrganisationCommand, {{context.camel}}Permissions['organisation.open'], {
      resource: () => ({ type: 'context', id: '{{context.kebab}}' }),
    }),
    requires(ProvisionAccountCommand, {{context.camel}}Permissions['account.provision'], {
      resource: () => ({ type: 'context', id: '{{context.kebab}}' }),
    }),
    requires(RemoveMemberCommand, {{context.camel}}Permissions['member.remove'], {
      resource: () => ({ type: 'context', id: '{{context.kebab}}' }),
    }),
    requires(RevokeDelegationCommand, {{context.camel}}Permissions['delegation.revoke'], {
      resource: () => ({ type: 'context', id: '{{context.kebab}}' }),
    }),
    requires(RevokeInvitationCommand, {{context.camel}}Permissions['invitation.revoke'], {
      resource: () => ({ type: 'context', id: '{{context.kebab}}' }),
    }),
    requires(SearchMembersQuery, {{context.camel}}Permissions['member.search'], {
      resource: () => ({ type: 'context', id: '{{context.kebab}}' }),
    }),
  ),
});

/**
 * The context on fakes, wired as `{{context.kebab}}.module.ts` wires it, behind an authorizer that
 * grants its permissions to every signed-in person: inside an organisation, its own policies
 * decide. `as(id)` is that person, `stranger` an actor the platform grants nothing.
 */
export function arrangeIdentity() {
  const ports = fakePorts();
  const buses = createTestBuses({ eventBusFailures: 'as-thrown' });
  const wired = { buses, ports, repositories: dispatchedBy(buses, ports), access: accessOn(buses) };

  buses.commandBus.use(people);
  buses.queryBus.use(people);
  registerAccountsAndOrganisations(wired);
  registerInvitations(wired);
  registerMembersAndDelegations(wired);
  publishTheFacts(buses);

  const start = (): Promise<void> => listen(wired);
  const as = (id: string): Actor => anActor().named(id).withRole(PERSON).build();

  return { application: { ...buses, start }, ...ports, as, stranger: anActor().named('stranger').build() };
}

/**
 * The same, started: its consumers listen, among them those that bring the identity provider in
 * line with the facts the context publishes (`application/integration/handlers/`).
 */
export async function startedIdentity(): Promise<ReturnType<typeof arrangeIdentity>> {
  const arranged = arrangeIdentity();

  await arranged.application.start();

  return arranged;
}

function fakePorts() {
  return {
    accounts: new FakeAccountRepository(),
    organisations: new FakeOrganisationRepository(),
    members: new FakeMemberRepository(),
    invitations: new FakeInvitationRepository(),
    delegations: new FakeDelegationRepository(),
    identityProvider: new FakeIdentityProviderAdmin(),
    tokens: new FakeInvitationTokens(),
    reader: new FakeSearchMembersReader(),
  };
}

/** The repositories as the application hands them to the handlers: a save announces the events of the aggregate. */
function dispatchedBy(buses: TestBuses, ports: ReturnType<typeof fakePorts>) {
  return {
    accounts: buses.dispatching(ports.accounts),
    organisations: buses.dispatching(ports.organisations),
    members: buses.dispatching(ports.members),
    invitations: buses.dispatching(ports.invitations),
    delegations: buses.dispatching(ports.delegations),
  };
}

/** The policies of the context, as the platform lists them in `access-policies.ts`. */
function accessOn(buses: TestBuses): Access {
  return new PolicyAccess({
    authorizer,
    clock: buses.clock,
    policies: [
      new ChangeMemberRolesPolicy(),
      new GrantDelegationsPolicy(),
      new InviteMembersPolicy(),
      new ReadMembersPolicy(),
      new RemoveMembersPolicy(),
      new RevokeDelegationsPolicy(),
      new RevokeInvitationsPolicy(),
    ],
  });
}

interface Wired {
  readonly buses: TestBuses;
  readonly ports: ReturnType<typeof fakePorts>;
  readonly repositories: ReturnType<typeof dispatchedBy>;
  readonly access: Access;
}

function registerAccountsAndOrganisations({ buses, repositories }: Wired): void {
  const { commandBus, ids, clock } = buses;
  const { accounts, organisations, members, delegations } = repositories;

  commandBus.register(ProvisionAccountCommand, new ProvisionAccountHandler(accounts, clock));

  commandBus.register(
    DeactivateAccountCommand,
    new DeactivateAccountHandler(accounts, organisations, members, delegations, clock),
  );

  commandBus.register(
    OpenOrganisationCommand,
    new OpenOrganisationHandler(organisations, members, accounts, ids, clock),
  );
}

function registerInvitations({ buses, repositories, ports, access }: Wired): void {
  const { commandBus, ids, clock } = buses;
  const { accounts, members, invitations, delegations } = repositories;

  commandBus.register(
    InviteMemberCommand,
    new InviteMemberHandler(invitations, members, delegations, ports.tokens, access, ids, clock),
  );

  commandBus.register(
    AcceptInvitationCommand,
    new AcceptInvitationHandler(invitations, members, accounts, ports.tokens, ids, clock),
  );

  commandBus.register(
    DeclineInvitationCommand,
    new DeclineInvitationHandler(invitations, accounts, ports.tokens, clock),
  );

  commandBus.register(
    RevokeInvitationCommand,
    new RevokeInvitationHandler(invitations, members, delegations, access, clock),
  );
}

function registerMembersAndDelegations({ buses, repositories, ports, access }: Wired): void {
  const { commandBus, queryBus, ids, clock } = buses;
  const { organisations, members, delegations } = repositories;

  commandBus.register(
    ChangeMemberRoleCommand,
    new ChangeMemberRoleHandler(organisations, members, delegations, access, clock),
  );

  commandBus.register(RemoveMemberCommand, new RemoveMemberHandler(organisations, members, delegations, access, clock));
  commandBus.register(GrantDelegationCommand, new GrantDelegationHandler(delegations, members, access, ids, clock));
  commandBus.register(RevokeDelegationCommand, new RevokeDelegationHandler(delegations, members, access, clock));
  queryBus.register(SearchMembersQuery, new SearchMembersHandler(ports.reader, members, delegations, access, clock));
}

/** The facts the context announces, published as the integration events of its published language. */
function publishTheFacts({ domainEvents, eventBus, ids }: TestBuses): void {
  domainEvents.on(
    AccountDeactivated.eventName,
    announcedBy(AccountDeactivated, new AccountDeactivatedPublisher(eventBus, ids)),
  );

  domainEvents.on(
    OrganisationOpened.eventName,
    announcedBy(OrganisationOpened, new OrganisationOpenedPublisher(eventBus, ids)),
  );

  domainEvents.on(MemberJoined.eventName, announcedBy(MemberJoined, new MemberJoinedPublisher(eventBus, ids)));

  domainEvents.on(
    MemberRoleChanged.eventName,
    announcedBy(MemberRoleChanged, new MemberRoleChangedPublisher(eventBus, ids)),
  );

  domainEvents.on(MemberRemoved.eventName, announcedBy(MemberRemoved, new MemberRemovedPublisher(eventBus, ids)));

  domainEvents.on(
    DelegationGranted.eventName,
    announcedBy(DelegationGranted, new DelegationGrantedPublisher(eventBus, ids)),
  );

  domainEvents.on(
    DelegationRevoked.eventName,
    announcedBy(DelegationRevoked, new DelegationRevokedPublisher(eventBus, ids)),
  );
}

/** A handler of the dispatcher that hands the events of one class to their publisher. */
function announcedBy<Fact>(
  fact: abstract new (...args: never[]) => Fact,
  publisher: { handle(event: Fact): Promise<void> },
) {
  return async (event: unknown): Promise<void> => {
    if (event instanceof fact) {
      await publisher.handle(event);
    }
  };
}

/** The consumers that bring the identity provider in line, each event handled once. */
function listen({ buses, repositories, ports }: Wired): Promise<void> {
  const processed = new InMemoryProcessedEventStore();

  const options = (consumer: string) => ({
    consumer: `{{context.kebab}}.${consumer}`,
    processed,
    unitOfWork: buses.unitOfWork,
    scope: buses.executionScope,
  });

  const disables = new AccountDeactivatedIntegrationHandler(ports.identityProvider);
  const joins = new MemberJoinedIntegrationHandler(repositories.members, ports.identityProvider);
  const removes = new MemberRemovedIntegrationHandler(repositories.members, ports.identityProvider);
  const opens = new OrganisationOpenedIntegrationHandler(ports.identityProvider);

  subscribeAll(buses.eventBus, [
    on(accountDeactivatedV1, (event) => disables.handle(event), options('provider-disables-account')),
    on(memberJoinedV1, (event) => joins.handle(event), options('provider-follows-joined-member')),
    on(memberRemovedV1, (event) => removes.handle(event), options('provider-follows-removed-member')),
    on(organisationOpenedV1, (event) => opens.handle(event), options('provider-opens-organisation')),
  ]);

  return Promise.resolve();
}
