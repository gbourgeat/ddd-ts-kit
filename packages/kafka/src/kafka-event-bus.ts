import { inspect } from 'node:util';
import type {
  EventBus,
  IntegrationEvent,
  IntegrationEventCallback,
  IntegrationEventSubscriber,
  Subscription,
} from '@ddd-ts-kit/kernel';
import { BrokerLink } from './connection/broker-link';
import { clusterOf } from './connection/cluster-of';
import { Consumption } from './consumption/consumption';
import { GroupConsumer } from './consumption/group-consumer';
import { ConsumerNameRequiredError } from './errors/consumer-name-required-error';
import { MESSAGING_SYSTEM } from './messaging-system';
import { EventBusClosedError } from './errors/event-bus-closed-error';
import type { KafkaEventBusOptions } from './options/kafka-event-bus-options';
import type { Settings } from './options/settings';
import { settingsOf } from './options/settings-of';
import { Publications } from './publication/publications';
import { DeadLetterReplay } from './replay/dead-letter-replay';
import { conceal } from './secrecy/conceal';
import type { ConsumerBinding } from './topology/consumer-binding';
import { describeTopic } from './topology/describe-topic';
import type { KafkaTopology } from './topology/kafka-topology';
import { topologyOf } from './topology/topology-of';
import type { TopologySettings } from './topology/topology-settings';

const DESCRIPTION = 'KafkaEventBus [clients concealed]';

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
  /** Read by what observes the bus from outside: the name of the transport. */
  readonly messagingSystem = MESSAGING_SYSTEM;

  private readonly settings: Settings;

  private readonly link: BrokerLink;

  private readonly publications: Publications;

  private readonly consumption: Consumption;

  private closed = false;

  constructor(options: KafkaEventBusOptions) {
    const settings = settingsOf(options);
    const topology = topologySettingsOf(settings);

    this.settings = settings;
    this.link = new BrokerLink(clusterOf(options), { ...settings, createTopics: settings.topics.create });

    this.publications = new Publications(this.link, {
      routing: settings,
      describe: (topic) => describeTopic(topology, topic, 'events'),
      failed: (code) => {
        settings.onFailure({ kind: 'connection', code });
      },
    });

    const dependencies = { link: this.link, publications: this.publications };

    this.consumption = new Consumption(
      (consumer) => new GroupConsumer(consumer, { ...dependencies, settings: { ...settings, topology } }),
    );

    conceal(this);
  }

  /** Records delivered to this bus whose handlers have not finished yet. */
  get deliveriesInFlight(): number {
    return this.consumption.inFlight;
  }

  /** Partitions the consumers of this bus own now: 0 means it consumes nothing. */
  get partitionsAssigned(): number {
    return this.consumption.partitionsAssigned;
  }

  /**
   * Resolves when every in-sync replica acknowledged every event, rejects otherwise: nothing
   * is buffered for later, so the caller (the outbox relay) knows what to retry.
   */
  async publish(events: readonly IntegrationEvent[]): Promise<void> {
    if (this.closed) {
      throw new EventBusClosedError();
    }

    if (events.length === 0) {
      return;
    }

    await this.publications.publish(events);
  }

  /** Subscribes the consumer named by the `consumer` option. */
  subscribe(type: string, handler: IntegrationEventCallback): Subscription {
    if (this.settings.consumer === undefined) {
      throw new ConsumerNameRequiredError();
    }

    return this.consume({ consumer: this.settings.consumer, type }, handler);
  }

  /** A subscriber for one consuming context, on the clients of this bus. */
  forConsumer(consumer: string): IntegrationEventSubscriber {
    if (consumer.length === 0) {
      throw new ConsumerNameRequiredError();
    }

    return { subscribe: (type, handler) => this.consume({ consumer, type }, handler) };
  }

  /**
   * Asks the cluster for its topics, creates those of the published types and of the
   * subscriptions made so far, then resolves once those subscriptions have their partitions.
   * Idempotent. A cluster out of reach rejects with `BROKER_UNAVAILABLE`, even with nothing to
   * create.
   */
  async assertTopology(): Promise<void> {
    if (this.closed) {
      throw new EventBusClosedError();
    }

    await this.link.reach();
    await this.link.declare(this.describeTopology().topics);
    await this.consumption.started();
  }

  describeTopology(): KafkaTopology {
    return topologyOf(topologySettingsOf(this.settings), this.consumption.bindings());
  }

  /**
   * Copies up to `limit` records from the dead-letter topic of a consumer back to the topic
   * they came from, for that consumer only and with a fresh attempt budget. Returns how many.
   */
  async replayDead({ consumer, type }: ConsumerBinding, limit = 100): Promise<number> {
    if (this.closed) {
      throw new EventBusClosedError();
    }

    const topic = this.settings.topicOf(type);
    const timeoutMs = this.settings.connectTimeoutMs * 3;
    const plan = { consumer, topic, limit, timeoutMs };

    await this.link.declare(topologyOf(topologySettingsOf(this.settings), [{ consumer, type }]).topics);

    return new DeadLetterReplay(this.link, this.publications, plan).run();
  }

  /** Stops consuming, waits for the handlers and the acknowledgements in flight, disconnects. */
  async close(): Promise<void> {
    if (this.closed) {
      return;
    }

    this.closed = true;
    await this.consumption.drain();
    await this.publications.close();
    await this.link.close();
  }

  /** What a serialisation shows of the bus: its name, never its clients or their properties. */
  toJSON(): string {
    return DESCRIPTION;
  }

  /** What `console.log` and `util.inspect` show of the bus: the same. */
  [inspect.custom](): string {
    return DESCRIPTION;
  }

  /** Adds a handler to the group of one consumer for one type; the group joins in the background. */
  private consume(binding: ConsumerBinding, handler: IntegrationEventCallback): Subscription {
    if (this.closed) {
      throw new EventBusClosedError();
    }

    return this.consumption.add(binding, handler);
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
