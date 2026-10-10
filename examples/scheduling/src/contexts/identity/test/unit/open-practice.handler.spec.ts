import { describe, expect, it } from 'vitest';
import { RoleBasedAuthorizer } from '@ddd-ts-kit/auth';
import { authorizationModule } from '@ddd-ts-kit/auth/di';
import { anActor } from '@ddd-ts-kit/auth/testing';
import { contextModule, createTestApplication, fake } from '@ddd-ts-kit/di';
import * as identityDeclarations from '../../identity.declarations.js';
import { platformTestModule } from '../../../../platform/platform-test.module.js';
import { identityPermissions } from '../../application/authorization/identity.permissions.js';
import { OpenPracticeCommand } from '../../application/commands/open-practice/open-practice.command.js';
import { IdentityRelationships } from '../../application/ports/identity-relationships.port.js';
import { DelegationRepository } from '../../domain/repositories/delegation.repository.js';
import { PersonRepository } from '../../domain/repositories/person.repository.js';
import { PracticeRepository } from '../../domain/repositories/practice.repository.js';
import { aPerson } from '../builders/person.builder.js';
import { FakeDelegationRepository } from '../fakes/delegation.repository.fake.js';
import { FakeIdentityRelationships } from '../fakes/identity-relationships.fake.js';
import { FakePersonRepository } from '../fakes/person.repository.fake.js';
import { FakePracticeRepository } from '../fakes/practice.repository.fake.js';

const holders = authorizationModule({
  authorizer: new RoleBasedAuthorizer({ roles: { holder: [identityPermissions['practice.open']] } }),
});

const holder = anActor().withRole('holder').build();

const opening = { name: 'Riverside', timeZone: 'Europe/Paris', managerId: 'person-ada' };

describe('Open practice', () => {
  it('saves the practice and answers its identifier', async () => {
    const { application, practiceRepository, personRepository } = arrange();

    await personRepository.save(aPerson().identifiedBy('person-ada').build());

    const id = await application.commandBus.execute(new OpenPracticeCommand(holder, opening));

    expect(id).toMatch(/^practice-\d+$/);
    expect(await practiceRepository.findById(id)).toBeDefined();
  });

  it('is refused to an actor who does not hold the permission practice.open', async () => {
    const { application } = arrange();

    await expect(
      application.commandBus.execute(new OpenPracticeCommand(anActor().build(), opening)),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('opens the practice in its time zone with a registered person as its first manager, and tells the other contexts', async () => {
    const { application, practiceRepository, personRepository, relationships } = arrange();

    await personRepository.save(aPerson().identifiedBy('person-ada').named('Ada Lovelace').build());
    const before = application.eventBus.published.length;

    const id = await application.commandBus.execute(new OpenPracticeCommand(holder, opening));

    const stored = await practiceRepository.findById(id);

    expect(stored?.name).toBe('Riverside');
    expect(stored?.timeZone.value).toBe('Europe/Paris');
    expect(stored?.members.map((member) => [member.personId, member.role])).toEqual([['person-ada', 'manager']]);
    expect(relationships.current).toContain(`manager person-ada of ${id}`);

    expect(application.eventBus.published.slice(before)).toMatchObject([
      {
        type: 'identity.practice.opened',
        payload: { practiceId: id, name: 'Riverside', timeZone: 'Europe/Paris', managerId: 'person-ada' },
      },
      {
        type: 'identity.practice.member-added',
        payload: {
          practiceId: id,
          personId: 'person-ada',
          role: 'manager',
          displayName: 'Ada Lovelace',
          timeZone: 'Europe/Paris',
        },
      },
    ]);
  });

  it('refuses a time zone that is not an IANA zone, and saves and publishes nothing', async () => {
    const { application, practiceRepository, personRepository } = arrange();

    await personRepository.save(aPerson().identifiedBy('person-ada').build());
    const before = application.eventBus.published.length;

    await expect(
      application.commandBus.execute(new OpenPracticeCommand(holder, { ...opening, timeZone: 'Europe/Atlantis' })),
    ).rejects.toMatchObject({
      code: 'UNKNOWN_TIME_ZONE',
    });

    expect(practiceRepository.all()).toEqual([]);
    expect(application.eventBus.published).toHaveLength(before);
  });

  it('refuses a first manager who is not a registered person, and saves and publishes nothing', async () => {
    const { application, practiceRepository } = arrange();

    await expect(application.commandBus.execute(new OpenPracticeCommand(holder, opening))).rejects.toMatchObject({
      code: 'PERSON_NOT_REGISTERED',
    });

    expect(practiceRepository.all()).toEqual([]);
    expect(application.eventBus.published).toEqual([]);
  });
});

function arrange() {
  const practiceRepository = new FakePracticeRepository();
  const personRepository = new FakePersonRepository();
  const delegationRepository = new FakeDelegationRepository();
  const relationships = new FakeIdentityRelationships();

  const application = createTestApplication({
    modules: [platformTestModule, contextModule('identity', identityDeclarations), holders],
    fakes: [
      fake(PracticeRepository, practiceRepository),
      fake(PersonRepository, personRepository),
      fake(DelegationRepository, delegationRepository),
      fake(IdentityRelationships, relationships),
    ],
    idPrefix: 'practice',
  });

  return { application, practiceRepository, personRepository, delegationRepository, relationships };
}
