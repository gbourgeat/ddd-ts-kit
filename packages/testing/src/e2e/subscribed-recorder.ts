import { AssertionError } from 'node:assert';
import type { IntegrationEvent, IntegrationEventSubscriber, Subscription } from '@ddd-ts-kit/kernel';
import type { EventRecorder } from './event-recorder.js';
import type { EventType } from './event-type.js';
import { eventually, type EventuallyOptions } from './eventually.js';

/** Records what a subscriber delivers for the types it was given, from its creation until `stop`. */
export class SubscribedRecorder implements EventRecorder {
  private readonly events: IntegrationEvent[] = [];

  private readonly types: readonly string[];

  private readonly subscriptions: Subscription[];

  constructor(subscriber: IntegrationEventSubscriber, types: readonly EventType[]) {
    this.types = types.map(nameOf);

    this.subscriptions = this.types.map((type) =>
      subscriber.subscribe(type, async (event) => void this.events.push(event)),
    );
  }

  received<Payload = unknown>(type?: EventType): IntegrationEvent<Payload>[] {
    const events = this.events.filter((event) => type === undefined || event.type === nameOf(type));

    // eslint-disable-next-line ddd-ts-kit/clean-no-escape-hatch -- the payload type is the caller's claim about what the application published; nothing here can check it
    return events as IntegrationEvent<Payload>[];
  }

  waitFor<Payload = unknown>(
    type: EventType,
    predicate: (event: IntegrationEvent<Payload>) => boolean = () => true,
    options?: EventuallyOptions,
  ): Promise<IntegrationEvent<Payload>> {
    this.assertCollected(nameOf(type));

    return eventually(() => this.firstMatch(nameOf(type), predicate), options);
  }

  stop(): void {
    for (const subscription of this.subscriptions.splice(0)) {
      subscription.unsubscribe();
    }
  }

  private assertCollected(type: string): void {
    if (!this.types.includes(type)) {
      throw new TypeError(`"${type}" is not collected: add it to the types given to collectEvents`);
    }
  }

  private firstMatch<Payload>(
    type: string,
    predicate: (event: IntegrationEvent<Payload>) => boolean,
  ): IntegrationEvent<Payload> {
    const candidates = this.received<Payload>(type);
    const match = candidates.find(predicate);

    if (match === undefined) {
      throw new AssertionError({
        message: `No "${type}" event matched; ${candidates.length} of that type received`,
      });
    }

    return match;
  }
}

function nameOf(type: EventType): string {
  return typeof type === 'string' ? type : type.type;
}
