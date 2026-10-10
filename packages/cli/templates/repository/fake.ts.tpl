import { InMemoryRepository, snapshots } from '@ddd-ts-kit/testing';
import { {{aggregate.pascal}} } from '{{alias.context}}/domain/aggregates/{{aggregate.kebab}}.aggregate.js';
import type { {{aggregate.pascal}}Repository } from '{{alias.context}}/domain/repositories/{{aggregate.kebab}}.repository.js';

export class Fake{{aggregate.pascal}}Repository extends InMemoryRepository<{{aggregate.pascal}}> implements {{aggregate.pascal}}Repository {
  constructor() {
    super(
      snapshots({
        toSnapshot: (stored: {{aggregate.pascal}}) => ({ id: stored.id, state: stored.toState() }),
        fromSnapshot: ({ id, state }) => {{aggregate.pascal}}.rehydrate(id, state),
      }),
    );
  }

  // TODO(domain): implement each lookup of {{aggregate.pascal}}Repository over `this.all()`, so that handlers are tested against a working repository.
}
