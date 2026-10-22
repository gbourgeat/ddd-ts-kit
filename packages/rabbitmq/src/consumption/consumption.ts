import type { ChannelModel, ConfirmChannel, ConsumeMessage } from 'amqplib';
import type { EventDelivery, IntegrationEvent, IntegrationEventCallback, Subscription } from '@ddd-ts-kit/kernel';
import { attemptOf } from '../codec/attempt-of';
import { decode } from '../codec/decode';
import { ATTEMPT_HEADER, DEAD_REASON_HEADER, ERROR_CODE_HEADER } from '../codec/headers';
import { republication } from '../codec/republication';
import { failureCode } from '../errors/failure-code';
import { ignore } from '../ignore';
import { MESSAGING_SYSTEM } from '../messaging-system';
import type { RabbitMqDelivery } from '../options/rabbit-mq-delivery';
import type { RabbitMqFailure } from '../options/rabbit-mq-failure';
import type { RetryOptions } from '../options/retry-options';
import { sendConfirmed } from '../publication/send-confirmed';
import type { ConsumerBinding } from '../topology/consumer-binding';
import { declareTopology } from '../topology/declare-topology';
import type { QueueNames } from '../topology/queue-names';
import { queueNamesOf } from '../topology/queue-names-of';
import { topologyOf } from '../topology/topology-of';
import type { TopologySettings } from '../topology/topology-settings';
import { failureOf } from './failure-of';
import { POISON_MESSAGE } from './poison-message';
import { track } from './track';

export interface ConsumptionSettings {
  readonly topology: TopologySettings;
  readonly prefetch: number;
  readonly retry: Required<RetryOptions>;
  readonly onFailure: (failure: RabbitMqFailure) => void;
  readonly onDelivery: (delivery: RabbitMqDelivery) => void;
  /** Called when the channel dies while the connection lives. */
  readonly channelLost: () => void;
}

interface QueueSubscription {
  readonly binding: ConsumerBinding;
  readonly queues: QueueNames;
  readonly handlers: Set<IntegrationEventCallback>;
  consumerTag: string | undefined;
}

interface Delivery {
  readonly channel: ConfirmChannel;
  readonly subscription: QueueSubscription;
  readonly message: ConsumeMessage;
}

/**
 * The consuming side: one durable queue per consumer and event type, manual acknowledgement
 * once every handler resolved, and for a failure a wait in the retry queue, then the dead
 * queue when the attempts are spent. A message is never requeued at once: no hot loop.
 */
export class Consumption {
  private readonly subscriptions = new Map<string, QueueSubscription>();

  private readonly starting = new Set<Promise<void>>();

  private readonly handling = new Set<Promise<void>>();

  private channel: ConfirmChannel | undefined;

  constructor(private readonly settings: ConsumptionSettings) {}

  get inFlight(): number {
    return this.handling.size;
  }

  bindings(): ConsumerBinding[] {
    return [...this.subscriptions.values()].map((subscription) => subscription.binding);
  }

  add(binding: ConsumerBinding, handler: IntegrationEventCallback): Subscription {
    const subscription = this.subscriptionOf(binding);

    subscription.handlers.add(handler);

    return {
      unsubscribe: () => {
        this.remove(subscription, handler);
      },
    };
  }

  async attach(model: ChannelModel): Promise<void> {
    const channel = await model.createConfirmChannel();

    channel.on('error', ignore);

    channel.on('close', () => {
      if (this.channel === channel) {
        this.settings.channelLost();
      }
    });

    await channel.prefetch(this.settings.prefetch);

    // The map is iterated live: a subscription added meanwhile is started by this loop.
    for (const subscription of this.subscriptions.values()) {
      await this.start(channel, subscription);
    }

    this.channel = channel;
  }

  detach(): void {
    this.channel = undefined;

    for (const subscription of this.subscriptions.values()) {
      subscription.consumerTag = undefined;
    }
  }

  /** Resolves once the subscriptions made so far are consuming, or have failed to. */
  async started(): Promise<void> {
    while (this.starting.size > 0) {
      await Promise.allSettled([...this.starting]);
    }
  }

  /** Stops taking messages, lets the handlers in progress finish and acknowledge. */
  async drain(): Promise<void> {
    const channel = this.channel;

    this.channel = undefined;
    const tags = [...this.subscriptions.values()].flatMap(({ consumerTag }) => consumerTag ?? []);

    await Promise.allSettled(tags.map(async (tag) => channel?.cancel(tag)));

    while (this.handling.size > 0) {
      await Promise.allSettled([...this.handling]);
    }

    await channel?.close().catch(ignore);
  }

  private subscriptionOf(binding: ConsumerBinding): QueueSubscription {
    const queues = queueNamesOf(binding);
    const existing = this.subscriptions.get(queues.work);

    if (existing !== undefined) {
      return existing;
    }

    const subscription = { binding, queues, handlers: new Set<never>(), consumerTag: undefined };

    this.subscriptions.set(queues.work, subscription);

    if (this.channel !== undefined) {
      track(this.starting, this.startOrGiveUp(this.channel, subscription));
    }

    return subscription;
  }

  private async startOrGiveUp(channel: ConfirmChannel, subscription: QueueSubscription): Promise<void> {
    try {
      await this.start(channel, subscription);
    } catch (error) {
      this.settings.onFailure({ kind: 'connection', code: failureCode(error) });
      this.settings.channelLost();
    }
  }

  private async start(channel: ConfirmChannel, subscription: QueueSubscription): Promise<void> {
    await declareTopology(channel, topologyOf(this.settings.topology, [subscription.binding]));

    const { consumerTag } = await channel.consume(subscription.queues.work, (message) => {
      if (message === null) {
        // Cancelled by the broker (queue deleted, node lost): rebuild everything.
        this.settings.channelLost();
      } else {
        track(this.handling, this.process({ channel, subscription, message }));
      }
    });

    subscription.consumerTag = consumerTag;
  }

  private async process(delivery: Delivery): Promise<void> {
    const { channel, subscription, message } = delivery;
    const event = decode(message);

    if (event === undefined) {
      await this.buryPoison(delivery);

      return;
    }

    if (subscription.handlers.size === 0) {
      quietly(() => {
        channel.nack(message, false, true);
      });

      return;
    }

    const code = await failureOf(subscription.handlers, event, this.deliveryOf(delivery));

    if (code === undefined) {
      this.settled(delivery, 'acknowledged');

      quietly(() => {
        channel.ack(message);
      });

      return;
    }

    await this.retryOrBury(delivery, event, code);
  }

  private deliveryOf({ subscription, message }: Delivery): EventDelivery {
    return {
      attempt: attemptOf(message),
      maxAttempts: this.settings.retry.maxAttempts,
      system: MESSAGING_SYSTEM,
      destination: subscription.queues.work,
      consumer: subscription.binding.consumer,
    };
  }

  private async buryPoison(delivery: Delivery): Promise<void> {
    const { work, dead } = delivery.subscription.queues;

    this.settings.onFailure({ kind: 'poison', queue: work, code: POISON_MESSAGE });
    this.settled(delivery, 'poison');

    await this.move(delivery, dead, {
      [ERROR_CODE_HEADER]: POISON_MESSAGE,
      [DEAD_REASON_HEADER]: 'poison',
    });
  }

  private async retryOrBury(delivery: Delivery, event: IntegrationEvent, code: string): Promise<void> {
    const { work, retry, dead: deadQueue } = delivery.subscription.queues;
    const attempt = attemptOf(delivery.message);
    const dead = attempt >= this.settings.retry.maxAttempts;
    const { id: eventId, type: eventType } = event;

    this.settings.onFailure({ kind: 'handler', queue: work, eventId, eventType, code, attempt, dead });
    this.settled(delivery, dead ? 'dead' : 'retried');

    if (dead) {
      const headers = { [ERROR_CODE_HEADER]: code, [DEAD_REASON_HEADER]: 'max-attempts' };

      await this.move(delivery, deadQueue, { ...headers, [ATTEMPT_HEADER]: attempt });
    } else {
      await this.move(delivery, retry, { [ERROR_CODE_HEADER]: code, [ATTEMPT_HEADER]: attempt + 1 });
    }
  }

  /** Confirmed copy to the other queue first, acknowledgement second: never lost in between. */
  private async move(
    { channel, message }: Delivery,
    queue: string,
    headers: Record<string, string | number>,
  ): Promise<void> {
    try {
      await sendConfirmed(channel, queue, republication(message, headers));
    } catch {
      quietly(() => {
        channel.nack(message, false, true);
      });

      return;
    }

    quietly(() => {
      channel.ack(message);
    });
  }

  private settled({ subscription, message }: Delivery, outcome: RabbitMqDelivery['outcome']): void {
    const queue = subscription.queues.work;

    this.settings.onDelivery({ queue, attempt: attemptOf(message), outcome });
  }

  private remove(subscription: QueueSubscription, handler: IntegrationEventCallback): void {
    subscription.handlers.delete(handler);

    if (subscription.handlers.size > 0) {
      return;
    }

    // The queue and its binding stay: the consumer keeps receiving, it only stopped reading.
    this.subscriptions.delete(subscription.queues.work);
    const { consumerTag } = subscription;

    if (this.channel !== undefined && consumerTag !== undefined) {
      void this.channel.cancel(consumerTag).catch(ignore);
    }
  }
}

// Acknowledging on a channel that died throws; the broker redelivers the message anyway.
function quietly(settle: () => void): void {
  try {
    settle();
  } catch {
    return;
  }
}
