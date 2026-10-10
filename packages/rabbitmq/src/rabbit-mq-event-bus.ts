import { inspect } from 'node:util';
import { connect } from 'amqplib';
import type {
  EventBus,
  IntegrationEvent,
  IntegrationEventCallback,
  IntegrationEventSubscriber,
  Subscription,
} from '@ddd-ts-kit/kernel';
import { ATTEMPT_HEADER } from './codec/headers.js';
import { republication } from './codec/republication.js';
import { BrokerLink } from './connection/broker-link.js';
import { Consumption } from './consumption/consumption.js';
import { ConsumerNameRequiredError } from './errors/consumer-name-required-error.js';
import { MESSAGING_SYSTEM } from './messaging-system.js';
import { EventBusClosedError } from './errors/event-bus-closed-error.js';
import type { RabbitMqEventBusOptions } from './options/rabbit-mq-event-bus-options.js';
import type { Settings } from './options/settings.js';
import { settingsOf } from './options/settings-of.js';
import { Publications } from './publication/publications.js';
import { conceal } from './secrecy/conceal.js';
import { sendConfirmed } from './publication/send-confirmed.js';
import type { ConsumerBinding } from './topology/consumer-binding.js';
import { declareTopology } from './topology/declare-topology.js';
import { queueNamesOf } from './topology/queue-names-of.js';
import type { RabbitMqTopology } from './topology/rabbit-mq-topology.js';
import { topologyOf } from './topology/topology-of.js';
import type { TopologySettings } from './topology/topology-settings.js';

const DESCRIPTION = 'RabbitMqEventBus [connection concealed]';

/**
 * The provider for RabbitMQ and other AMQP 0-9-1 brokers.
 *
 * Publishing: a durable topic exchange, routing key = event type, persistent messages, and
 * `publish` resolves only when the broker confirmed every message, so it is a safe target for
 * the outbox relay. Consuming: a durable queue per consumer and event type, acknowledged
 * after the handlers resolved, a bounded number of delayed retries, then a dead queue.
 * Delivery is at least once and unordered: consumers deduplicate.
 */
export class RabbitMqEventBus implements EventBus {
  /** Read by what observes the bus from outside: the name of the transport. */
  readonly messagingSystem = MESSAGING_SYSTEM;

  private readonly settings: Settings;

  private readonly link: BrokerLink;

  private readonly publications: Publications;

  private readonly consumption: Consumption;

  private closed = false;

  constructor(options: RabbitMqEventBusOptions) {
    this.settings = settingsOf(options, connect);

    const channelLost = (): void => {
      this.link.restart();
    };

    this.publications = new Publications({ ...this.settings, channelLost });

    this.consumption = new Consumption({
      ...this.settings,
      topology: topologySettingsOf(this.settings),
      channelLost,
    });

    this.link = new BrokerLink(this.settings, {
      opened: async (model) => {
        await this.publications.attach(model);
        await this.consumption.attach(model);
      },
      lost: () => {
        this.publications.detach();
        this.consumption.detach();
      },
      failed: (code) => {
        this.settings.onFailure({ kind: 'connection', code });
      },
    });

    conceal(this);
  }

  /** Messages delivered to this bus whose handlers have not finished yet. */
  get deliveriesInFlight(): number {
    return this.consumption.inFlight;
  }

  /**
   * Resolves when the broker confirmed every event, rejects otherwise: nothing is buffered
   * for later, so the caller (the outbox relay) knows what to retry.
   */
  async publish(events: readonly IntegrationEvent[]): Promise<void> {
    if (events.length === 0) {
      return;
    }

    await this.link.opened();
    // The queues of this bus are bound before it publishes: it never misses its own events.
    await this.consumption.started();
    await this.publications.publish(events);
  }

  /** Subscribes the consumer named by the `consumer` option. */
  subscribe(type: string, handler: IntegrationEventCallback): Subscription {
    if (this.settings.consumer === undefined) {
      throw new ConsumerNameRequiredError();
    }

    return this.consume({ consumer: this.settings.consumer, type }, handler);
  }

  /** A subscriber for one consuming context, on the connection of this bus. */
  forConsumer(consumer: string): IntegrationEventSubscriber {
    if (consumer.length === 0) {
      throw new ConsumerNameRequiredError();
    }

    return { subscribe: (type, handler) => this.consume({ consumer, type }, handler) };
  }

  /**
   * Connects if needed and declares the exchange, the queues and the bindings of the
   * subscriptions made so far. Idempotent. Resolves once those subscriptions are consuming.
   */
  async assertTopology(): Promise<void> {
    const model = await this.link.opened();
    // On a channel of its own: a refused declaration closes the channel it was made on.
    const channel = await model.createChannel();

    channel.on('error', () => undefined);
    await declareTopology(channel, this.describeTopology());
    await channel.close();
    await this.consumption.started();
  }

  describeTopology(): RabbitMqTopology {
    return topologyOf(topologySettingsOf(this.settings), this.consumption.bindings());
  }

  /**
   * Moves up to `limit` messages from the dead queue of a consumer back to its work queue,
   * with a fresh attempt budget. Returns how many were moved.
   */
  async replayDead(binding: ConsumerBinding, limit = 100): Promise<number> {
    const { work, dead } = queueNamesOf(binding);
    const channel = await (await this.link.opened()).createConfirmChannel();

    channel.on('error', () => undefined);
    let replayed = 0;

    try {
      for (; replayed < limit; replayed += 1) {
        const message = await channel.get(dead, { noAck: false });

        if (message === false) {
          break;
        }

        await sendConfirmed(channel, work, republication(message, { [ATTEMPT_HEADER]: 1 }));
        channel.ack(message);
      }
    } finally {
      await channel.close().catch(() => undefined);
    }

    return replayed;
  }

  /** Stops consuming, waits for the handlers and the confirmations in flight, disconnects. */
  async close(): Promise<void> {
    if (this.closed) {
      return;
    }

    this.closed = true;
    await this.consumption.drain();
    await this.publications.close();
    await this.link.close();
  }

  /** What a serialisation shows of the bus: its name, never its connection. */
  toJSON(): string {
    return DESCRIPTION;
  }

  /** What `console.log` and `util.inspect` show of the bus: the same. */
  [inspect.custom](): string {
    return DESCRIPTION;
  }

  /** Adds a handler to the queue of one consumer for one type, and connects if needed. */
  private consume(binding: ConsumerBinding, handler: IntegrationEventCallback): Subscription {
    if (this.closed) {
      throw new EventBusClosedError();
    }

    const subscription = this.consumption.add(binding, handler);

    // Connects in the background; a failure is reported by the link and retried.
    void this.link.opened().catch(() => undefined);

    return subscription;
  }
}

function topologySettingsOf(settings: Settings): TopologySettings {
  return {
    exchange: settings.exchange,
    queueType: settings.queueType,
    retryDelayMs: settings.retry.delayMs,
  };
}
