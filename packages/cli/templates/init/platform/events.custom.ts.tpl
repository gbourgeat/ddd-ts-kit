import { InMemoryEventBus, type EventBus, type IntegrationEventSubscriber } from '@ddd-ts-kit/kernel';
import { CustomEventBus } from './custom-event-bus.js';

/** The provider integration events are delivered to, and how each consuming context listens to it. */
export interface EventProvider {
  readonly bus: EventBus;
  /** The subscriber of one consuming context, under its own name. */
  subscriberFor(context: string): IntegrationEventSubscriber;
  start(): Promise<void>;
  close(): Promise<void>;
}

/** For the tools and the tests that run without a broker: the same ports, in the process. */
export function inProcessEvents(): EventProvider {
  const bus = new InMemoryEventBus();
  return { bus, subscriberFor: () => bus, start: () => Promise.resolve(), close: () => Promise.resolve() };
}

// TODO(platform): give the adapter its connection settings from the validated config, name one subscriber per consuming context, and open and close the connection in start and close.
export function createEventProvider(): EventProvider {
  const bus = new CustomEventBus();
  return { bus, subscriberFor: () => bus, start: () => Promise.resolve(), close: () => Promise.resolve() };
}
