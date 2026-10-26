import { afterEach, beforeEach, describe, expect, it } from '{{tests.module}}';
import { InMemoryEventStore, InMemorySubjectKeyStore, PersonalDataCipher } from '@ddd-ts-kit/kernel';
import { repositoryContract } from '@ddd-ts-kit/testing/contracts';
import { {{aggregate.pascal}} } from '{{alias.context}}/domain/aggregates/{{aggregate.kebab}}.aggregate{{alias.ext}}';
import { EventStore{{aggregate.pascal}}Repository } from '{{alias.context}}/infrastructure/persistence/event-store-{{aggregate.kebab}}.repository{{alias.ext}}';
import { Fake{{aggregate.pascal}}Repository } from '{{alias.context}}/test/fakes/{{aggregate.kebab}}.repository.fake{{alias.ext}}';

const runner = { describe, it, expect, beforeEach, afterEach };

const bornAt = new Date('2026-03-01T00:00:00.000Z');
let born = 0;

const expectations = {
  // A new aggregate, with its birth event to store: the builder hands one rebuilt from a history, which a store already holds.
  createAggregate: () => {
    born += 1;

    return {{aggregate.pascal}}.create(`{{aggregate.kebab}}-${born}`, bornAt);
  },
  // TODO(domain): add `mutate: (changed: {{aggregate.pascal}}) => changed.<a business method that records an event>(...)`, so that the suite proves an update is stored and a stale save is refused; the case stays pending until then.
  idOf: (subject: {{aggregate.pascal}}) => subject.id,
  stateOf: (subject: {{aggregate.pascal}}) => subject.toState(),
};

repositoryContract<{{aggregate.pascal}}>(runner, {
  ...expectations,
  name: 'Fake{{aggregate.pascal}}Repository',
  createRepository: () => new Fake{{aggregate.pascal}}Repository(),
});

repositoryContract<{{aggregate.pascal}}>(runner, {
  ...expectations,
  name: 'EventStore{{aggregate.pascal}}Repository on the in-memory event store',
  createRepository: () =>
    new EventStore{{aggregate.pascal}}Repository(new InMemoryEventStore(), new PersonalDataCipher(new InMemorySubjectKeyStore())),
});
