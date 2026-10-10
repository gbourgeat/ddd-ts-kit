import type { EventBus, IntegrationEventSubscriber } from '@ddd-ts-kit/kernel';

/** The provider integration events are delivered to, and how each consuming context listens to it. */
export interface EventProvider {
  readonly bus: EventBus;

  /** The subscriber of one consuming context, under its own name. */
  forConsumer(name: string): IntegrationEventSubscriber;

  start(): Promise<void>;

  close(): Promise<void>;
}
