import { EventSerializer, EventSourcedRepository, type EventStore, type PersonalDataCipher } from '@ddd-ts-kit/kernel';
{{#if style.declared}}
import { Repository } from '@ddd-ts-kit/kernel/declarations';
{{/if}}
import { {{aggregate.pascal}}, type {{aggregate.pascal}}Event, type {{aggregate.pascal}}State } from '{{alias.context}}/domain/aggregates/{{aggregate.kebab}}.aggregate{{alias.ext}}';
{{#if style.declared}}
import { {{aggregate.pascal}}Repository } from '{{alias.context}}/domain/repositories/{{aggregate.kebab}}.repository{{alias.ext}}';
{{/if}}
{{#unless style.declared}}
import type { {{aggregate.pascal}}Repository } from '{{alias.context}}/domain/repositories/{{aggregate.kebab}}.repository{{alias.ext}}';
{{/unless}}
import { {{aggregate.camel}}Events } from '{{alias.context}}/infrastructure/persistence/{{aggregate.kebab}}-events.mapper{{alias.ext}}';

/** The stream of {{aggregate.pascal}} is `{{context.kebab}}.{{aggregate.kebab}}-<id>` in the event store the platform binds. */
{{#if style.declared}}
@Repository({{aggregate.pascal}}Repository)
{{/if}}
export class EventStore{{aggregate.pascal}}Repository implements {{aggregate.pascal}}Repository {
  private readonly streams: EventSourcedRepository<{{aggregate.pascal}}, {{aggregate.pascal}}Event, {{aggregate.pascal}}State>;

  constructor(store: EventStore, cipher: PersonalDataCipher) {
    this.streams = new EventSourcedRepository({
      store,
      category: '{{context.kebab}}.{{aggregate.kebab}}',
      serializer: new EventSerializer<{{aggregate.pascal}}Event>({{aggregate.camel}}Events, { cipher }),
      rehydrate: (id, history) => {{aggregate.pascal}}.rehydrate(id, history),
      // TODO(domain): when a stream grows long enough to slow a load, add `snapshots: { ...{{aggregate.camel}}Snapshots, store: snapshots, every: <n> }` (a SnapshotStore injected here, a snapshot mapper with its own shape version): see docs/concepts/event-sourcing.md of ddd-ts-kit.
    });
  }

  findById(id: string): Promise<{{aggregate.pascal}} | undefined> {
    return this.streams.findById(id);
  }

  save(saved: {{aggregate.pascal}}): Promise<void> {
    return this.streams.save(saved);
  }
}
