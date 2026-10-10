import type { EventSubscribers } from '@ddd-ts-kit/kernel';
import { RecordingSubscriber } from './recording-subscriber.js';

/** What a broker bus does: each consuming context gets a subscriber of its own, made on first demand. */
export class SubscribersByContext implements EventSubscribers {
  private readonly subscribers = new Map<string, RecordingSubscriber>();

  forContext(name: string): RecordingSubscriber {
    const known = this.subscribers.get(name);

    if (known !== undefined) return known;

    const created = new RecordingSubscriber();

    this.subscribers.set(name, created);

    return created;
  }

  contexts(): readonly string[] {
    return [...this.subscribers.keys()];
  }
}
