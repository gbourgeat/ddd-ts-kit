import { InMemoryEventBus } from '@ddd-ts-kit/kernel';
import type { EventProvider } from '@/platform/events/event-provider';

/** For the tools and the tests that run without a broker: the same ports, in the process. */
export function inProcessEvents(): EventProvider {
  const bus = new InMemoryEventBus({ failures: 'as-thrown' });

  return { bus, forConsumer: () => bus, start: () => Promise.resolve(), close: () => Promise.resolve() };
}
