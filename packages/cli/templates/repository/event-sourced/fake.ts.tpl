import { InMemoryEventStore, InMemorySubjectKeyStore, PersonalDataCipher } from '@ddd-ts-kit/kernel';
import type { {{aggregate.pascal}} } from '{{alias.context}}/domain/aggregates/{{aggregate.kebab}}.aggregate{{alias.ext}}';
import type { {{aggregate.pascal}}Repository } from '{{alias.context}}/domain/repositories/{{aggregate.kebab}}.repository{{alias.ext}}';
import { EventStore{{aggregate.pascal}}Repository } from '{{alias.context}}/infrastructure/persistence/event-store-{{aggregate.kebab}}.repository{{alias.ext}}';

/** The adapter itself over the in-memory stores of the kernel: what a handler spec saves to, events and all. */
export class Fake{{aggregate.pascal}}Repository implements {{aggregate.pascal}}Repository {
  readonly store = new InMemoryEventStore();

  private readonly adapter = new EventStore{{aggregate.pascal}}Repository(
    this.store,
    new PersonalDataCipher(new InMemorySubjectKeyStore()),
  );

  findById(id: string): Promise<{{aggregate.pascal}} | undefined> {
    return this.adapter.findById(id);
  }

  save(saved: {{aggregate.pascal}}): Promise<void> {
    return this.adapter.save(saved);
  }

  // TODO(domain): implement each lookup of {{aggregate.pascal}}Repository over the events of `this.store`, so that handlers are tested against a working repository.
}
