import { defineStoredEvent, type StoredEventTypes } from '@ddd-ts-kit/kernel';
import type { {{name.pascal}}Event } from '{{alias.context}}/domain/aggregates/{{name.kebab}}.aggregate{{alias.ext}}';
import { {{event.pascal}} } from '{{alias.context}}/domain/events/{{event.kebab}}.event{{alias.ext}}';

// TODO(domain): give each data type the fields its event carries beyond its id and instant, in plain data (texts, numbers, ISO dates); personal data is written `personalData(subjectId, value)`. A type stored once never changes: a change is a new version with its upcaster (event-sourcing/upcaster-required).
interface {{event.pascal}}Data {}

/** How the events of {{name.pascal}} are kept in its stream: one entry per event, read back by `decode`. */
export const {{name.camel}}Events: StoredEventTypes<{{name.pascal}}Event> = {
  [{{event.pascal}}.eventName]: defineStoredEvent({{event.pascal}}, {
    version: 1,
    encode: (): {{event.pascal}}Data => ({}),
    decode: (_data, { aggregateId, occurredAt }) => new {{event.pascal}}(aggregateId, occurredAt),
  }),
};
