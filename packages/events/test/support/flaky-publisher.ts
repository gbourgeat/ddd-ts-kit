import type { IntegrationEvent, IntegrationEventPublisher } from '@ddd-ts-kit/kernel';

/** An error without a code, whose message quotes what must never be stored or logged. */
class BrokerDown extends Error {
  constructor() {
    super('connection refused to amqp://user:secret@broker');
  }
}

/** A provider that refuses the listed events a given number of times, then accepts them. */
export class FlakyPublisher implements IntegrationEventPublisher {
  readonly delivered: string[] = [];

  private readonly remainingFailures: Map<string, number>;

  constructor(failures: Record<string, number> = {}) {
    this.remainingFailures = new Map(Object.entries(failures));
  }

  async publish(events: readonly IntegrationEvent[]): Promise<void> {
    for (const { id } of events) {
      const remaining = this.remainingFailures.get(id) ?? 0;

      if (remaining > 0) {
        this.remainingFailures.set(id, remaining - 1);

        throw new BrokerDown();
      }

      this.delivered.push(id);
    }
  }
}
