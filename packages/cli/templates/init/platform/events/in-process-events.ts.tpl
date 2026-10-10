import { InMemoryEventBus } from '@ddd-ts-kit/kernel';
import type { EventProvider } from './event-provider.js';

{{#if broker.none}}
/** Same process, no broker: {{#if events.outbox}}the relay of the outbox publishes to this bus, which runs the consumers{{/if}}{{#unless events.outbox}}use cases publish to this bus, which runs the consumers{{/unless}}. */
{{/if}}
{{#unless broker.none}}
/** For the tools and the tests that run without a broker: the same ports, in the process. */
{{/unless}}
export function inProcessEvents(): EventProvider {
  const bus = new InMemoryEventBus();

  return { bus, forConsumer: () => bus, start: () => Promise.resolve(), close: () => Promise.resolve() };
}
