import type { IntegrationEvent, IntegrationEventPublisher } from '@ddd-ts-kit/kernel';

class BrokerDown extends Error {
  readonly code = 'BROKER_DOWN';
}

/** A provider that refuses the listed events a given number of times, then accepts them. */
export class RecoveringPublisher implements IntegrationEventPublisher {
  readonly delivered: string[] = [];
  readonly #remainingFailures: Map<string, number>;

  constructor(failures: Record<string, number> = {}) {
    this.#remainingFailures = new Map(Object.entries(failures));
  }

  async publish(events: readonly IntegrationEvent[]): Promise<void> {
    for (const { id } of events) {
      const remaining = this.#remainingFailures.get(id) ?? 0;
      if (remaining > 0) {
        this.#remainingFailures.set(id, remaining - 1);
        throw new BrokerDown();
      }
      this.delivered.push(id);
    }
  }
}

/** A provider that keeps every publication waiting until the test opens the gate. */
export class GatedPublisher implements IntegrationEventPublisher {
  readonly delivered: string[] = [];
  #open: () => void = () => undefined;
  #gate = new Promise<void>((resolve) => {
    this.#open = resolve;
  });
  #entered: () => void = () => undefined;
  readonly entered = new Promise<void>((resolve) => {
    this.#entered = resolve;
  });

  async publish(events: readonly IntegrationEvent[]): Promise<void> {
    this.#entered();
    await this.#gate;
    this.delivered.push(...events.map((event) => event.id));
  }

  open(): void {
    this.#open();
  }
}

export async function eventually(condition: () => boolean | Promise<boolean>, timeoutMs = 2_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!(await condition())) {
    if (Date.now() > deadline) {
      throw new Error('The condition was not met in time');
    }
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}
