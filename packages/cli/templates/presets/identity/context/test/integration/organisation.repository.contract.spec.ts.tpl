import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from '{{tests.module}}';
import { FixedClock, FixedExecutionScope, executionContext, type Actor } from '@ddd-ts-kit/kernel';
import { repositoryContract } from '@ddd-ts-kit/testing/contracts';
import type { Organisation } from '{{alias.context}}/domain/aggregates/organisation.aggregate{{alias.ext}}';
import { {{preset.adapter.pascal}}OrganisationRepository } from '{{alias.context}}/infrastructure/persistence/{{preset.adapter.kebab}}-organisation.repository{{alias.ext}}';
import { openTestDatabase, type TestDatabase } from '{{alias.platform}}/database/open-test-database{{alias.ext}}';
import { anOrganisation } from '{{alias.context}}/test/builders/organisation.builder{{alias.ext}}';
import { FakeOrganisationRepository } from '{{alias.context}}/test/fakes/organisation.repository.fake{{alias.ext}}';

const runner = { describe, it, expect, beforeEach, afterEach };
const clock = new FixedClock(new Date('2026-01-01T00:00:00.000Z'));
const actor: Actor = { id: 'subject-ada', type: 'user', roles: [], attributes: {} };
const scope = new FixedExecutionScope(executionContext({ correlationId: 'contract-spec', actor, origin: 'test' }));

const expectations = {
  createAggregate: () => anOrganisation().build(),
  mutate: () => undefined,
  idOf: (subject: Organisation) => subject.id,
  stateOf: (subject: Organisation) => subject.toState(),
};

let database: TestDatabase;

beforeAll(async () => {
  database = await openTestDatabase();
});

afterAll(async () => {
  await database.close();
});

repositoryContract<Organisation>(runner, {
  ...expectations,
  name: 'FakeOrganisationRepository',
  createRepository: () => new FakeOrganisationRepository(),
});

repositoryContract<Organisation>(runner, {
  ...expectations,
  name: '{{preset.adapter.pascal}}OrganisationRepository',
  createRepository: async () => {
    await database.reset();

    return new {{preset.adapter.pascal}}OrganisationRepository(database.persistence.database, scope, clock);
  },
});
