import type {
  EventBus,
  IntegrationEvent,
  IntegrationEventCallback,
  IntegrationEventSubscriber,
  Subscription,
} from '@ddd-ts-kit/kernel';
import { replay } from './replay.js';
import { Consumption } from './consumption.js';
import { ConsumerNameRequiredError } from './errors/consumer-name-required-error.js';
import { EventBusClosedError } from './errors/event-bus-closed-error.js';
import type { RedisStreamsEventBusOptions } from './options/redis-streams-event-bus-options.js';
import type { Settings } from './options/settings.js';
import { settingsOf } from './options/settings-of.js';
import { Publications } from './publications.js';
import { ServerLink } from './server-link.js';
import type { ConsumerBinding } from './topology/consumer-binding.js';
import { declareTopology } from './topology/declare-topology.js';
import type { RedisStreamsTopology } from './topology/redis-streams-topology.js';
import { streamNamesOf } from './topology/stream-names-of.js';
import { topologyOf } from './topology/topology-of.js';

/**
 * The provider on Redis Streams, for Redis, Dragonfly and Valkey.
 *
 * Publishing: one stream per event type, one `XADD` per event, and `publish` resolves only
 * when the server answered an entry id for every event, so it is a safe target for the outbox
 * relay. Consuming: one consumer group per consumer name, a blocking read on a dedicated
 * connection, `XACK` after the handlers resolved, a bounded number of delayed redeliveries
 * from the pending entry list, then a dead stream. Delivery is at least once: consumers
 * deduplicate.
 */
export class RedisStreamsEventBus implements EventBus {
  private readonly settings: Settings;

  private readonly link: ServerLink;

  private readonly publications: Publications;

  private readonly consumption: Consumption;

  private closed = false;

  constructor(options: RedisStreamsEventBusOptions) {
    this.settings = settingsOf(options);

    const { reconnect, blockMs } = this.settings;

    this.link = new ServerLink({ connection: options.connection, reconnect, blockMs }, (code) => {
      this.settings.onFailure({ kind: 'connection', code });
    });

    this.publications = new Publications(this.settings);
    this.consumption = new Consumption(this.link, this.settings);
  }

  /** Entries delivered to this bus whose handlers have not finished yet. */
  get deliveriesInFlight(): number {
    return this.consumption.inFlight;
  }

  /**
   * Resolves when the server acknowledged every event, rejects otherwise: nothing is buffered
   * for later, so the caller (the outbox relay) knows what to retry.
   */
  async publish(events: readonly IntegrationEvent[]): Promise<void> {
    if (events.length === 0) return;

    if (this.closed) throw new EventBusClosedError();

    const client = await this.link.ready();

    // The groups of this bus exist before it publishes: it never misses its own events.
    await this.consumption.declare(client);
    await this.publications.publish(client, events);
  }

  /** Subscribes the consumer named by the `consumer` option. */
  subscribe(type: string, handler: IntegrationEventCallback): Subscription {
    if (this.settings.consumer === undefined) throw new ConsumerNameRequiredError();

    return this.bind({ consumer: this.settings.consumer, type }, handler);
  }

  /** A subscriber for one consuming context, with a reading connection of its own. */
  forConsumer(consumer: string): IntegrationEventSubscriber {
    if (consumer.length === 0) throw new ConsumerNameRequiredError();

    return { subscribe: (type, handler) => this.bind({ consumer, type }, handler) };
  }

  /**
   * Connects if needed and creates the streams and the groups of the subscriptions made so
   * far. Idempotent: a group that exists keeps its position.
   */
  async assertTopology(): Promise<void> {
    await declareTopology(await this.link.ready(), this.describeTopology());
  }

  describeTopology(): RedisStreamsTopology {
    return topologyOf(this.settings, this.consumption.bindings());
  }

  /**
   * Moves up to `limit` entries from the dead stream of a consumer back to the stream of
   * their type, for that consumer only, with a fresh attempt budget. Returns how many moved.
   */
  async replayDead(binding: ConsumerBinding, limit = 100): Promise<number> {
    const { events, dead } = streamNamesOf(binding, this.settings.streamOf);
    const client = await this.link.ready();

    return replay(client, { stream: events, deadStream: dead, consumer: binding.consumer, limit });
  }

  /** Stops reading, waits for the handlers in progress to settle, disconnects what it opened. */
  async close(): Promise<void> {
    if (this.closed) return;

    this.closed = true;
    await this.consumption.drain();
    await this.link.close();
  }

  private bind(binding: ConsumerBinding, handler: IntegrationEventCallback): Subscription {
    if (this.closed) throw new EventBusClosedError();

    return this.consumption.add(binding, handler);
  }
}
