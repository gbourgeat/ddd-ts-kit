import type { KafkaJS } from '@confluentinc/kafka-javascript';
import type { EventDelivery, IntegrationEvent, IntegrationEventCallback, Subscription } from '@ddd-ts-kit/kernel';
import { decode } from '../codec/decode.js';
import {
  ATTEMPT_HEADER,
  DEAD_REASON_HEADER,
  ERROR_CODE_HEADER,
  REPLAY_FOR_HEADER,
  SOURCE_HEADER,
} from '../codec/headers.js';
import { republication } from '../codec/republication.js';
import { sourceOf } from '../codec/source-of.js';
import { textHeader } from '../codec/text-header.js';
import { reasonOf } from '../errors/reason-of.js';
import type { KafkaDelivery } from '../options/kafka-delivery.js';
import { MESSAGING_SYSTEM } from '../messaging-system.js';
import type { KafkaFailure } from '../options/kafka-failure.js';
import type { RetryOptions } from '../options/retry-options.js';
import type { Publications } from '../publication/publications.js';
import { deadTopicOf } from '../topology/dead-topic-of.js';
import { Attempts } from './attempts.js';
import type { Backoff } from './backoff.js';
import { failureOf } from './failure-of.js';
import { POISON_MESSAGE } from './poison-message.js';
import { postpone } from './postpone.js';
import type { Timers } from './timers.js';

export interface RecordHandlingDependencies {
  readonly publications: Publications;
  readonly retry: Required<RetryOptions>;
  readonly backoff: Backoff;
  readonly timers: Timers;
  /** Commits the offset that follows a record, through the client of the group. */
  readonly commit: (position: KafkaJS.TopicPartitionOffset) => Promise<void>;
  readonly onFailure: (failure: KafkaFailure) => void;
  readonly onDelivery: (delivery: KafkaDelivery) => void;
}

type Delivery = KafkaJS.EachMessagePayload;

/**
 * What a consuming context does with one record. An offset is committed once every handler
 * of the record resolved, never before. A record whose handler fails keeps its place: its
 * partition is paused for the delay and the record is read again, so the records of a key
 * stay in order, and after the last attempt it is copied to the dead-letter topic and the
 * partition moves on.
 */
export class RecordHandling {
  private readonly handlers = new Map<string, Set<IntegrationEventCallback>>();

  private readonly attempts = new Attempts();

  private readonly waitingForHandlers = new Set<() => void>();

  private handling = 0;

  constructor(
    private readonly consumer: string,
    private readonly dependencies: RecordHandlingDependencies,
  ) {}

  get inFlight(): number {
    return this.handling;
  }

  types(): string[] {
    return [...this.handlers.keys()];
  }

  add(type: string, handler: IntegrationEventCallback): Subscription {
    const handlers = this.handlers.get(type) ?? new Set();

    this.handlers.set(type, handlers.add(handler));
    this.resumeWaiting();

    return {
      // The group keeps its place in the log: the consumer only stopped reading.
      unsubscribe: () => {
        handlers.delete(handler);
      },
    };
  }

  /** The group took these partitions back: their next owner counts the attempts again. */
  forget(partitions: readonly KafkaJS.TopicPartition[]): void {
    for (const partition of partitions) {
      this.attempts.forget(partition);
    }
  }

  /** The records that wait for a handler stay where they are: the consumer is going away. */
  abandonWaiting(): void {
    this.waitingForHandlers.clear();
  }

  async deliver(delivery: Delivery): Promise<void> {
    this.handling += 1;

    try {
      await this.process(delivery);
    } finally {
      this.handling -= 1;
    }
  }

  private resumeWaiting(): void {
    for (const resume of this.waitingForHandlers) {
      resume();
    }

    this.waitingForHandlers.clear();
  }

  private async process(delivery: Delivery): Promise<void> {
    if (this.isForAnotherConsumer(delivery)) {
      await this.commit(delivery);

      return;
    }

    const event = decode(delivery.message.value);

    if (event === undefined) {
      await this.buryPoison(delivery);

      return;
    }

    const handlers = this.handlers.get(event.type);

    if (handlers === undefined) {
      // A type this consumer never subscribed to, on a topic that carries several.
      await this.commit(delivery);

      return;
    }

    await this.handle(delivery, event, handlers);
  }

  /** A replayed dead letter is on the topic for the one consumer that had given up on it. */
  private isForAnotherConsumer(delivery: Delivery): boolean {
    const target = textHeader(delivery, REPLAY_FOR_HEADER);

    return target !== undefined && target !== this.consumer;
  }

  private async handle(
    delivery: Delivery,
    event: IntegrationEvent,
    handlers: ReadonlySet<IntegrationEventCallback>,
  ): Promise<void> {
    if (handlers.size === 0) {
      postpone(delivery, (resume) => this.waitingForHandlers.add(resume));
    }

    const code = await failureOf(handlers, event, this.deliveryOf(delivery));

    if (code === undefined) {
      this.settled(delivery, 'acknowledged');
      await this.commit(delivery);
    } else {
      await this.retryOrBury(delivery, event, code);
    }
  }

  private deliveryOf(delivery: Delivery): EventDelivery {
    return {
      attempt: this.attempts.of(delivery),
      maxAttempts: this.dependencies.retry.maxAttempts,
      system: MESSAGING_SYSTEM,
      destination: delivery.topic,
      consumer: this.consumer,
    };
  }

  private async retryOrBury(delivery: Delivery, event: IntegrationEvent, code: string): Promise<void> {
    const { retry, timers, onFailure } = this.dependencies;
    const attempt = this.attempts.of(delivery);
    const dead = attempt >= retry.maxAttempts;
    const { id: eventId, type: eventType } = event;
    const { consumer } = this;

    onFailure({ kind: 'handler', consumer, topic: delivery.topic, eventId, eventType, code, attempt, dead });
    this.settled(delivery, dead ? 'dead' : 'retried');

    if (dead) {
      const headers = { [ERROR_CODE_HEADER]: code, [DEAD_REASON_HEADER]: 'max-attempts' };

      await this.bury(delivery, { ...headers, [ATTEMPT_HEADER]: String(attempt) });

      return;
    }

    this.attempts.failed(delivery);

    postpone(delivery, (resume) => {
      timers.later(resume, retry.delayMs);
    });
  }

  private async buryPoison(delivery: Delivery): Promise<void> {
    const { consumer } = this;
    const { topic } = delivery;

    this.dependencies.onFailure({ kind: 'poison', consumer, topic, code: POISON_MESSAGE });
    this.settled(delivery, 'poison');
    await this.bury(delivery, { [ERROR_CODE_HEADER]: POISON_MESSAGE, [DEAD_REASON_HEADER]: 'poison' });
  }

  /** Acknowledged copy to the dead-letter topic first, commit second: never lost in between. */
  private async bury(delivery: Delivery, headers: Record<string, string>): Promise<void> {
    const dead = deadTopicOf(this.consumer, delivery.topic);
    const source = { [SOURCE_HEADER]: sourceOf(delivery) };

    try {
      await this.dependencies.publications.send(republication(delivery, dead, { ...headers, ...source }));
    } catch (error) {
      this.postponeAfter(delivery, error);
    }

    await this.commit(delivery);
  }

  private async commit(delivery: Delivery): Promise<void> {
    const { topic, partition, message } = delivery;
    const offset = String(BigInt(message.offset) + 1n);

    this.attempts.forget(delivery);

    try {
      await this.dependencies.commit({ topic, partition, offset });
      this.dependencies.backoff.reset();
    } catch (error) {
      this.postponeAfter(delivery, error);
    }
  }

  // The partition must not move past a record that is neither committed nor parked.
  private postponeAfter(delivery: Delivery, error: unknown): never {
    const { backoff, timers, onFailure } = this.dependencies;

    onFailure({ kind: 'connection', code: reasonOf(error) });
    const delay = backoff.delayMs;

    backoff.failed();

    postpone(delivery, (resume) => {
      timers.later(resume, delay);
    });
  }

  private settled(delivery: Delivery, outcome: KafkaDelivery['outcome']): void {
    const { topic, partition } = delivery;
    const attempt = this.attempts.of(delivery);

    this.dependencies.onDelivery({ consumer: this.consumer, topic, partition, attempt, outcome });
  }
}
