import { defineStoredEvent, type StoredEventTypes } from '@ddd-ts-kit/kernel';
import type { {{name.pascal}}Event } from '{{alias.context}}/domain/aggregates/{{name.kebab}}.aggregate{{alias.ext}}';
import { {{event.pascal}} } from '{{alias.context}}/domain/events/{{event.kebab}}.event{{alias.ext}}';

// TODO(domain): an event that carries nothing keeps `Record<string, never>`; for one that carries fields beyond its id and instant, write the type as an `interface` with them, in plain data (texts, numbers, ISO dates); personal data is written `personalData(subjectId, value)`. A type stored once never changes: a change is a new version with its upcaster (event-sourcing/upcaster-required).
type {{event.pascal}}Data = Record<string, never>;

/** How the events of {{name.pascal}} are kept in its stream: one entry per event, read back by `decode`. */
export const {{name.camel}}Events: StoredEventTypes<{{name.pascal}}Event> = {
  [{{event.pascal}}.eventName]: defineStoredEvent({{event.pascal}}, {
    version: 1,
    encode: (): {{event.pascal}}Data => ({}),
    decode: (_data, { aggregateId, occurredAt }) => new {{event.pascal}}(aggregateId, occurredAt),
  }),
};
