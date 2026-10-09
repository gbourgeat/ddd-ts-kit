{{#if adapter.needsDatabase}}
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from '{{tests.module}}';
{{/if}}
{{#unless adapter.needsDatabase}}
import { afterEach, beforeEach, describe, expect, it } from '{{tests.module}}';
{{/unless}}
import { repositoryContract } from '@ddd-ts-kit/testing/contracts';
import type { {{aggregate.pascal}} } from '../../domain/aggregates/{{aggregate.kebab}}.aggregate.js';
import { {{adapter.pascal}}{{aggregate.pascal}}Repository } from '../../infrastructure/persistence/{{adapter.kebab}}-{{aggregate.kebab}}.repository.js';
{{#if adapter.needsDatabase}}
import { openTestDatabase, type TestDatabase } from '{{paths.integrationToPlatform}}/database/testing.js';
{{/if}}
import { {{aggregate.article}}{{aggregate.pascal}} } from '../builders/{{aggregate.kebab}}.builder.js';
import { Fake{{aggregate.pascal}}Repository } from '../fakes/{{aggregate.kebab}}.repository.fake.js';

const runner = { describe, it, expect, beforeEach, afterEach };

const expectations = {
  createAggregate: () => {{aggregate.article}}{{aggregate.pascal}}().build(),
  mutate: (changed: {{aggregate.pascal}}) => {
    // TODO(domain): call a business method of {{aggregate.pascal}} on `changed` that alters its state, so that the suite proves an update is really stored.
  },
  idOf: (subject: {{aggregate.pascal}}) => subject.id,
  stateOf: (subject: {{aggregate.pascal}}) => subject.toState(),
};

repositoryContract<{{aggregate.pascal}}>(runner, {
  ...expectations,
  name: 'Fake{{aggregate.pascal}}Repository',
  createRepository: () => new Fake{{aggregate.pascal}}Repository(),
});

{{#if adapter.needsDatabase}}
let database: TestDatabase;

beforeAll(async () => {
  database = await openTestDatabase();
});

afterAll(async () => {
  await database.close();
});

repositoryContract<{{aggregate.pascal}}>(runner, {
  ...expectations,
  name: '{{adapter.pascal}}{{aggregate.pascal}}Repository',
  createRepository: async () => {
    await database.reset();
    return new {{adapter.pascal}}{{aggregate.pascal}}Repository(database.persistence.database);
  },
});
{{/if}}
{{#unless adapter.needsDatabase}}
repositoryContract<{{aggregate.pascal}}>(runner, {
  ...expectations,
  name: '{{adapter.pascal}}{{aggregate.pascal}}Repository',
  createRepository: () => new {{adapter.pascal}}{{aggregate.pascal}}Repository(),
});
{{/unless}}
