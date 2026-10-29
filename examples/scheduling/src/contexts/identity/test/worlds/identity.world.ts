import { RoleBasedAuthorizer } from '@ddd-ts-kit/auth';
import { authorizationModule } from '@ddd-ts-kit/auth/di';
import { contextModule, createTestApplication, fake, type ContextModule, type Override } from '@ddd-ts-kit/di';
import * as identityDeclarations from '@/contexts/identity/identity.declarations';
import { platformTestModule } from '@/platform/composition/platform-test.module';
import { DelegationRepository } from '@/contexts/identity/domain/repositories/delegation.repository';
import { IdentityRelationships } from '@/contexts/identity/application/ports/identity-relationships.port';
import { PersonRepository } from '@/contexts/identity/domain/repositories/person.repository';
import { PracticeRepository } from '@/contexts/identity/domain/repositories/practice.repository';
import { FakeDelegationRepository } from '@/contexts/identity/test/fakes/delegation.repository.fake';
import { FakeIdentityRelationships } from '@/contexts/identity/test/fakes/identity-relationships.fake';
import { FakePersonRepository } from '@/contexts/identity/test/fakes/person.repository.fake';
import { FakePracticeRepository } from '@/contexts/identity/test/fakes/practice.repository.fake';

const nobody = authorizationModule({ authorizer: new RoleBasedAuthorizer({ roles: {} }) });

export interface IdentityWorldFakes {
  readonly delegationRepository: FakeDelegationRepository;
  readonly identityRelationships: FakeIdentityRelationships;
  readonly personRepository: FakePersonRepository;
  readonly practiceRepository: FakePracticeRepository;
}

export interface IdentityWorldOptions {
  readonly now?: Date;
  readonly idPrefix?: string;
  readonly modules?: readonly ContextModule[];
  readonly fakes?: readonly Override[];
  readonly tenants?: readonly string[];
  readonly given?: (fakes: IdentityWorldFakes) => Promise<void>;
}

export async function anIdentityWorld({ modules = [nobody], given, ...settings }: IdentityWorldOptions = {}) {
  const context = contextModule('identity', identityDeclarations);

  const fakes = buildFakes();

  await given?.(fakes);

  const application = createTestApplication({
    ...settings,
    eventBusFailures: 'as-thrown',
    modules: [platformTestModule, context, ...modules],
    fakes: overridden(settings.fakes, [
      fake(DelegationRepository, fakes.delegationRepository),
      fake(IdentityRelationships, fakes.identityRelationships),
      fake(PersonRepository, fakes.personRepository),
      fake(PracticeRepository, fakes.practiceRepository),
    ]),
  });

  return { application, ...fakes };
}

// The fakes a spec hands replace those the world builds for the same port.
function overridden(handed: readonly Override[] | undefined, built: readonly Override[]): Override[] {
  const replaced = new Set((handed ?? []).map(([port]) => port));

  return [...built.filter(([port]) => !replaced.has(port)), ...(handed ?? [])];
}

function buildFakes(): IdentityWorldFakes {
  return {
    delegationRepository: new FakeDelegationRepository(),
    identityRelationships: new FakeIdentityRelationships(),
    personRepository: new FakePersonRepository(),
    practiceRepository: new FakePracticeRepository(),
  };
}
