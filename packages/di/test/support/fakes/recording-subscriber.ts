import type {
  IntegrationEvent,
  IntegrationEventCallback,
  IntegrationEventSubscriber,
  Subscription,
} from '@ddd-ts-kit/kernel';

/** A subscriber of its own, in memory: remembers what subscribed to it and delivers on demand. */
export class RecordingSubscriber implements IntegrationEventSubscriber {
  private readonly callbacks: { readonly type: string; readonly handle: IntegrationEventCallback }[] = [];

  subscribe(type: string, handle: IntegrationEventCallback): Subscription {
    const entry = { type, handle };

    this.callbacks.push(entry);

    return {
      unsubscribe: () => {
        this.callbacks.splice(this.callbacks.indexOf(entry), 1);
      },
    };
  }

  /** The event types subscribed to, one entry per subscription still held. */
  subscriptions(): readonly string[] {
    return this.callbacks.map(({ type }) => type);
  }

  async deliver(event: IntegrationEvent): Promise<void> {
    for (const { type, handle } of [...this.callbacks]) {
      if (type === event.type) await handle(event);
    }
  }
}
