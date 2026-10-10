import { describe, expect, it } from 'vitest';
import { RoleBasedAuthorizer } from '@ddd-ts-kit/auth';
import { authorizationModule } from '@ddd-ts-kit/auth/di';
import { anActor } from '@ddd-ts-kit/auth/testing';
import { contextModule, createTestApplication, fake } from '@ddd-ts-kit/di';
import * as identityDeclarations from '@/contexts/identity/identity.declarations.js';
import { platformTestModule } from '@/platform/platform-test.module.js';
import { identityPermissions } from '@/contexts/identity/application/authorization/identity.permissions.js';
import { RegisterPersonCommand } from '@/contexts/identity/application/commands/register-person/register-person.command.js';
import { IdentityRelationships } from '@/contexts/identity/application/ports/identity-relationships.port.js';
import { PersonRepository } from '@/contexts/identity/domain/repositories/person.repository.js';
import { aPerson } from '@/contexts/identity/test/builders/person.builder.js';
import { FakeIdentityRelationships } from '@/contexts/identity/test/fakes/identity-relationships.fake.js';
import { FakePersonRepository } from '@/contexts/identity/test/fakes/person.repository.fake.js';

const holders = authorizationModule({
  authorizer: new RoleBasedAuthorizer({ roles: { holder: [identityPermissions['person.register']] } }),
});

const holder = anActor().named('person-ada').withRole('holder').build();

describe('Register person', () => {
  it('saves the person and answers its identifier', async () => {
    const { application, personRepository } = arrange();

    const id = await application.commandBus.execute(
      new RegisterPersonCommand(holder, 'Ada Lovelace', 'ada@example.com'),
    );

    expect(id).toBe('person-ada');
    expect(await personRepository.findById(id)).toBeDefined();
  });

  it('is refused to an actor who does not hold the permission person.register', async () => {
    const { application } = arrange();

    await expect(
      application.commandBus.execute(new RegisterPersonCommand(anActor().build(), 'Ada Lovelace', 'ada@example.com')),
    ).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('makes the actor known as a person, with the name and the address they gave, and tells the other contexts', async () => {
    const { application, personRepository, relationships } = arrange();

    await application.commandBus.execute(new RegisterPersonCommand(holder, ' Ada  Lovelace ', 'Ada@Example.com'));

    const stored = await personRepository.findById('person-ada');

    expect(stored?.displayName.value).toBe('Ada Lovelace');
    expect(stored?.email.value).toBe('ada@example.com');
    expect(stored?.registeredAt).toEqual(application.clock.now());
    expect(relationships.current).toEqual(['person person-ada']);

    expect(application.eventBus.published).toMatchObject([
      {
        type: 'identity.person.registered',
        version: 1,
        payload: { personId: 'person-ada', displayName: 'Ada Lovelace', email: 'ada@example.com' },
      },
    ]);
  });

  it('updates the name and the address of a person who registers again and announces nothing new', async () => {
    const { application, personRepository } = arrange();

    await personRepository.save(
      aPerson().identifiedBy('person-ada').named('Ada Lovelace').reachedAt('ada@example.com').build(),
    );

    const announced = application.eventBus.published.length;

    await application.commandBus.execute(new RegisterPersonCommand(holder, 'Ada King', 'ada.king@example.com'));

    const stored = await personRepository.findById('person-ada');

    expect(stored?.displayName.value).toBe('Ada King');
    expect(stored?.email.value).toBe('ada.king@example.com');
    expect(application.eventBus.published).toHaveLength(announced);
  });

  it.each([
    { what: 'a blank name', displayName: '   ', email: 'ada@example.com', code: 'INVALID_DISPLAY_NAME' },
    {
      what: 'an address nobody can be written to at',
      displayName: 'Ada Lovelace',
      email: 'ada-at-example',
      code: 'INVALID_EMAIL',
    },
  ])('refuses $what, and saves and publishes nothing', async ({ displayName, email, code }) => {
    const { application, personRepository } = arrange();

    await expect(
      application.commandBus.execute(new RegisterPersonCommand(holder, displayName, email)),
    ).rejects.toMatchObject({ code });

    expect(personRepository.all()).toEqual([]);
    expect(application.eventBus.published).toEqual([]);
  });
});

function arrange() {
  const personRepository = new FakePersonRepository();
  const relationships = new FakeIdentityRelationships();

  const application = createTestApplication({
    modules: [platformTestModule, contextModule('identity', identityDeclarations), holders],
    fakes: [fake(PersonRepository, personRepository), fake(IdentityRelationships, relationships)],
    idPrefix: 'person',
  });

  return { application, personRepository, relationships };
}
