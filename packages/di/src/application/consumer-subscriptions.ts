import {
  EventSubscribers,
  ExecutionScope,
  IntegrationEventSubscriber,
  ProcessedEventStore,
  UnitOfWork,
  type Subscription,
} from '@ddd-ts-kit/kernel';
import type { Token } from '@ddd-ts-kit/kernel/declarations';
import type { ConsumerRuntime } from '../consumer/consumer-runtime.js';
import type { EventConsumption } from '../wiring/event-consumption.js';
import type { BoundPorts } from './bound-ports.js';
import { failuresOf } from './failures-of.js';

/** The integration event handlers of the modules, subscribed while the application runs. */
export class ConsumerSubscriptions {
  private subscriptions: Subscription[] | undefined;

  constructor(
    private readonly consumptions: readonly EventConsumption[],
    private readonly ports: BoundPorts,
  ) {}

  /** Once, however many times the application is started. */
  subscribe(): void {
    this.subscriptions ??= this.subscribed();
  }

  /** Answers what failed: one subscription that cannot be released does not keep the others. */
  unsubscribe(): unknown[] {
    const subscriptions = this.subscriptions ?? [];

    this.subscriptions = undefined;

    return failuresOf(subscriptions.map((subscription) => () => subscription.unsubscribe()));
  }

  private subscribed(): Subscription[] {
    if (this.consumptions.length === 0) return [];

    const runtime = this.runtime();

    return this.consumptions.map((consumption) =>
      this.subscriberOf(consumption.module).subscribe(
        consumption.type,
        consumption.subscribe(this.ports.resolve, runtime),
      ),
    );
  }

  private runtime(): ConsumerRuntime {
    const processed = this.resolveIfBound(ProcessedEventStore);
    const scope = this.resolveIfBound(ExecutionScope);

    return {
      ...(processed === undefined ? {} : { processed }),
      ...(scope === undefined ? {} : { scope }),
      ...(this.ports.isBound(UnitOfWork) ? { unitOfWork: this.unitOfWorkOfEachEvent() } : {}),
    };
  }

  /** Resolved at each event, as the command bus does at each command: a test may fake it after the start. */
  private unitOfWorkOfEachEvent(): UnitOfWork {
    return { run: (work) => this.ports.resolve(UnitOfWork).run(work) };
  }

  /** Each context listens through its own subscriber, which is the one bus unless a broker says otherwise. */
  private subscriberOf(context: string): IntegrationEventSubscriber {
    const subscribers = this.resolveIfBound(EventSubscribers);

    return subscribers === undefined
      ? this.ports.resolve(IntegrationEventSubscriber)
      : subscribers.forContext(context);
  }

  private resolveIfBound<T>(target: Token<T>): T | undefined {
    return this.ports.isBound(target) ? this.ports.resolve(target) : undefined;
  }
}
