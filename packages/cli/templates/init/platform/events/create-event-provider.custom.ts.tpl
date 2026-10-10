import { CustomEventBus } from '{{alias.platform}}/events/custom-event-bus.js';
import type { EventProvider } from '{{alias.platform}}/events/event-provider.js';

// TODO(platform): give the adapter its connection settings from the validated config, name one subscriber per consuming context, and open and close the connection in start and close.
export function createEventProvider(): EventProvider {
  const bus = new CustomEventBus();

  return { bus, forConsumer: () => bus, start: () => Promise.resolve(), close: () => Promise.resolve() };
}
