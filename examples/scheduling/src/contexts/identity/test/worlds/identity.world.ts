import { RoleBasedAuthorizer } from '@ddd-ts-kit/auth';
import { authorizationModule } from '@ddd-ts-kit/auth/di';
import { contextModule, createTestApplication, fake, type ContextModule } from '@ddd-ts-kit/di';
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
  readonly given?: (fakes: IdentityWorldFakes) => Promise<void>;
}

export async function anIdentityWorld({ modules = [nobody], given, ...settings }: IdentityWorldOptions = {}) {
  const context = contextModule('identity', identityDeclarations);

  const fakes = {
    delegationRepository: new FakeDelegationRepository(),
    identityRelationships: new FakeIdentityRelationships(),
    personRepository: new FakePersonRepository(),
    practiceRepository: new FakePracticeRepository(),
  };

  await given?.(fakes);

  const application = createTestApplication({
    ...settings,
    modules: [platformTestModule, context, ...modules],
    fakes: [
      fake(DelegationRepository, fakes.delegationRepository),
      fake(IdentityRelationships, fakes.identityRelationships),
      fake(PersonRepository, fakes.personRepository),
      fake(PracticeRepository, fakes.practiceRepository),
    ],
  });

  return { application, ...fakes };
}
