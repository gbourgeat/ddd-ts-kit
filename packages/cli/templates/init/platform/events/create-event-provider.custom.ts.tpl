import { CustomEventBus } from '{{alias.platform}}/events/custom-event-bus{{alias.ext}}';
import type { EventProvider } from '{{alias.platform}}/events/event-provider{{alias.ext}}';

// TODO(platform): give the adapter its connection settings from the validated config, name one subscriber per consuming context, and open and close the connection in start and close.
export function createEventProvider(): EventProvider {
  const bus = new CustomEventBus();

  return { bus, forConsumer: () => bus, start: () => Promise.resolve(), close: () => Promise.resolve() };
}
