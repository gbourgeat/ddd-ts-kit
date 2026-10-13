import { RoleBasedAuthorizer } from '@ddd-ts-kit/auth';
import { authorizationModule } from '@ddd-ts-kit/auth/di';
import { anActor } from '@ddd-ts-kit/auth/testing';
import { contextModule, createTestApplication, fake } from '@ddd-ts-kit/di';
import type { Actor } from '@ddd-ts-kit/kernel';
import * as {{context.camel}}Declarations from '{{alias.context}}/{{context.kebab}}.declarations{{alias.ext}}';
import { platformTestModule } from '{{alias.platform}}/platform-test.module{{alias.ext}}';
import { {{context.camel}}Permissions } from '{{alias.context}}/application/authorization/{{context.kebab}}.permissions{{alias.ext}}';
import { IdentityProviderAdmin } from '{{alias.context}}/application/ports/identity-provider-admin.port{{alias.ext}}';
import { InvitationTokens } from '{{alias.context}}/application/ports/invitation-tokens.port{{alias.ext}}';
import { SearchMembersReader } from '{{alias.context}}/application/ports/search-members-reader.port{{alias.ext}}';
import { AccountRepository } from '{{alias.context}}/domain/repositories/account.repository{{alias.ext}}';
import { DelegationRepository } from '{{alias.context}}/domain/repositories/delegation.repository{{alias.ext}}';
import { InvitationRepository } from '{{alias.context}}/domain/repositories/invitation.repository{{alias.ext}}';
import { MemberRepository } from '{{alias.context}}/domain/repositories/member.repository{{alias.ext}}';
import { OrganisationRepository } from '{{alias.context}}/domain/repositories/organisation.repository{{alias.ext}}';
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

const people = authorizationModule({
  authorizer: new RoleBasedAuthorizer({ roles: { [PERSON]: Object.values({{context.camel}}Permissions) } }),
});

/**
 * The context on fakes, behind an authorizer that grants its permissions to every signed-in
 * person: inside an organisation, its own policies decide. `as(id)` is that person, `stranger`
 * an actor the platform grants nothing.
 */
export function arrangeIdentity() {
  const ports = {
    accounts: new FakeAccountRepository(),
    organisations: new FakeOrganisationRepository(),
    members: new FakeMemberRepository(),
    invitations: new FakeInvitationRepository(),
    delegations: new FakeDelegationRepository(),
    identityProvider: new FakeIdentityProviderAdmin(),
    tokens: new FakeInvitationTokens(),
    reader: new FakeSearchMembersReader(),
  };

  const application = createTestApplication({
    modules: [platformTestModule, contextModule('{{context.kebab}}', {{context.camel}}Declarations), people],
    fakes: [
      fake(AccountRepository, ports.accounts),
      fake(OrganisationRepository, ports.organisations),
      fake(MemberRepository, ports.members),
      fake(InvitationRepository, ports.invitations),
      fake(DelegationRepository, ports.delegations),
      fake(IdentityProviderAdmin, ports.identityProvider),
      fake(InvitationTokens, ports.tokens),
      fake(SearchMembersReader, ports.reader),
    ],
  });

  const as = (id: string): Actor => anActor().named(id).withRole(PERSON).build();

  return { application, ...ports, as, stranger: anActor().named('stranger').build() };
}
