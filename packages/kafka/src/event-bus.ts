import type {
  EventBus,
  IntegrationEvent,
  IntegrationEventCallback,
  IntegrationEventSubscriber,
  Subscription,
} from '@ddd-ts-kit/kernel';
import { BrokerLink } from './broker-link.js';
import { Consumption } from './consumption.js';
import { DeadLetterReplay } from './dead-letters.js';
import { ConsumerNameRequiredError, EventBusClosedError } from './errors.js';
import { GroupConsumer } from './group-consumer.js';
import { settingsOf, type KafkaEventBusOptions, type Settings } from './options.js';
import { Publications } from './publications.js';
import {
  topicDescription,
  topologyOf,
  type ConsumerBinding,
  type KafkaTopology,
  type TopologySettings,
} from './topology.js';

/**
 * The provider for Apache Kafka and other logs speaking its protocol.
 *
 * Publishing: one topic per event type unless `topicOf` says otherwise, record key =
 * `keyOf(event)`, an idempotent producer with `acks=all`, and `publish` resolves only when
 * every record is acknowledged, so it is a safe target for the outbox relay. Consuming: one
 * consumer group per consuming context, the offset committed after the handlers resolved, a
 * bounded number of delayed retries in place, then a dead-letter topic. Delivery is at least
 * once, in order for the records of one key: consumers deduplicate.
 */
export class KafkaEventBus implements EventBus {
  readonly #settings: Settings;
  readonly #link: BrokerLink;
  readonly #publications: Publications;
  readonly #consumption: Consumption;
  #closed = false;

  constructor(options: KafkaEventBusOptions) {
    const settings = settingsOf(options);
    const topology = topologySettingsOf(settings);
    this.#settings = settings;
    this.#link = new BrokerLink({ ...settings, createTopics: settings.topics.create });
    this.#publications = new Publications(this.#link, {
      routing: settings,
      describe: (topic) => topicDescription(topology, topic, 'events'),
      failed: (code) => {
        settings.onFailure({ kind: 'connection', code });
      },
    });
    const dependencies = { link: this.#link, publications: this.#publications };
    this.#consumption = new Consumption(
      (consumer) => new GroupConsumer(consumer, { ...dependencies, settings: { ...settings, topology } }),
    );
  }

  /** Records delivered to this bus whose handlers have not finished yet. */
  get deliveriesInFlight(): number {
    return this.#consumption.inFlight;
  }

  /** Partitions the consumers of this bus own now: 0 means it consumes nothing. */
  get partitionsAssigned(): number {
    return this.#consumption.partitionsAssigned;
  }

  /**
   * Resolves when every in-sync replica acknowledged every event, rejects otherwise: nothing
   * is buffered for later, so the caller (the outbox relay) knows what to retry.
   */
  async publish(events: readonly IntegrationEvent[]): Promise<void> {
    if (this.#closed) {
      throw new EventBusClosedError();
    }
    if (events.length === 0) {
      return;
    }
    await this.#publications.publish(events);
  }

  /** Subscribes the consumer named by the `consumer` option. */
  subscribe(type: string, handler: IntegrationEventCallback): Subscription {
    if (this.#settings.consumer === undefined) {
      throw new ConsumerNameRequiredError();
    }
    return this.#subscribe({ consumer: this.#settings.consumer, type }, handler);
  }

  /** A subscriber for one consuming context, on the clients of this bus. */
  forConsumer(consumer: string): IntegrationEventSubscriber {
    if (consumer.length === 0) {
      throw new ConsumerNameRequiredError();
    }
    return { subscribe: (type, handler) => this.#subscribe({ consumer, type }, handler) };
  }

  /**
   * Creates the topics of the published types and of the subscriptions made so far, then
   * resolves once those subscriptions have their partitions. Idempotent.
   */
  async assertTopology(): Promise<void> {
    if (this.#closed) {
      throw new EventBusClosedError();
    }
    await this.#link.declare(this.describeTopology().topics);
    await this.#consumption.started();
  }

  describeTopology(): KafkaTopology {
    return topologyOf(topologySettingsOf(this.#settings), this.#consumption.bindings());
  }

  /**
   * Copies up to `limit` records from the dead-letter topic of a consumer back to the topic
   * they came from, for that consumer only and with a fresh attempt budget. Returns how many.
   */
  async replayDead({ consumer, type }: ConsumerBinding, limit = 100): Promise<number> {
    if (this.#closed) {
      throw new EventBusClosedError();
    }
    const topic = this.#settings.topicOf(type);
    const timeoutMs = this.#settings.connectTimeoutMs * 3;
    const plan = { consumer, topic, limit, timeoutMs };
    await this.#link.declare(topologyOf(topologySettingsOf(this.#settings), [{ consumer, type }]).topics);
    return new DeadLetterReplay(this.#link, this.#publications, plan).run();
  }

  /** Stops consuming, waits for the handlers and the acknowledgements in flight, disconnects. */
  async close(): Promise<void> {
    if (this.#closed) {
      return;
    }
    this.#closed = true;
    await this.#consumption.drain();
    await this.#publications.close();
    await this.#link.close();
  }

  #subscribe(binding: ConsumerBinding, handler: IntegrationEventCallback): Subscription {
    if (this.#closed) {
      throw new EventBusClosedError();
    }
    return this.#consumption.add(binding, handler);
  }
}

function topologySettingsOf(settings: Settings): TopologySettings {
  return {
    topicOf: settings.topicOf,
    publishedTypes: settings.publishedTypes,
    partitions: settings.topics.partitions,
    replicationFactor: settings.topics.replicationFactor,
  };
}
