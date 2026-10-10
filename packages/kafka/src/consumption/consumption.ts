import type { IntegrationEventCallback, Subscription } from '@ddd-ts-kit/kernel';
import type { ConsumerBinding } from '../topology/consumer-binding.js';
import type { GroupConsumer } from './group-consumer.js';

/** The consuming side of a bus: one group consumer per consuming context, opened on demand. */
export class Consumption {
  private readonly groups = new Map<string, GroupConsumer>();

  constructor(private readonly open: (consumer: string) => GroupConsumer) {}

  get inFlight(): number {
    return this.sum((group) => group.inFlight);
  }

  get partitionsAssigned(): number {
    return this.sum((group) => group.partitionsAssigned);
  }

  bindings(): ConsumerBinding[] {
    return [...this.groups.values()].flatMap((group) => group.types().map((type) => ({ consumer: group.name, type })));
  }

  add({ consumer, type }: ConsumerBinding, handler: IntegrationEventCallback): Subscription {
    const group = this.groups.get(consumer) ?? this.open(consumer);

    this.groups.set(consumer, group);

    return group.add(type, handler);
  }

  /** Resolves once the subscriptions made so far are consuming, or have failed to. */
  async started(): Promise<void> {
    await Promise.all([...this.groups.values()].map((group) => group.started()));
  }

  async drain(): Promise<void> {
    await Promise.all([...this.groups.values()].map((group) => group.drain()));
  }

  private sum(count: (group: GroupConsumer) => number): number {
    return [...this.groups.values()].reduce((total, group) => total + count(group), 0);
  }
}
