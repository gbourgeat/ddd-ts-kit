import { inspect } from 'node:util';
import { jetstreamManager } from '@nats-io/jetstream';
import { connect } from '@nats-io/transport-node';
import type {
  EventBus,
  IntegrationEvent,
  IntegrationEventCallback,
  IntegrationEventSubscriber,
  Subscription,
} from '@ddd-ts-kit/kernel';
import { REPLAY_FOR_HEADER } from './codec/headers';
import { republication } from './codec/republication';
import { BrokerLink } from './connection/broker-link';
import { Consumption } from './consumption/consumption';
import { ConsumerNameRequiredError } from './errors/consumer-name-required-error';
import { MESSAGING_SYSTEM } from './messaging-system';
import { EventBusClosedError } from './errors/event-bus-closed-error';
import type { NatsEventBusOptions } from './options/nats-event-bus-options';
import type { Settings } from './options/settings';
import { settingsOf } from './options/settings-of';
import { Publications } from './publication/publications';
import { conceal } from './secrecy/conceal';
import { bindingNamesOf } from './topology/binding-names-of';
import type { ConsumerBinding } from './topology/consumer-binding';
import { deadStreamOf } from './topology/dead-stream-of';
import { declareTopology } from './topology/declare-topology';
import type { NatsTopology } from './topology/nats-topology';
import { topologyOf } from './topology/topology-of';
import type { TopologySettings } from './topology/topology-settings';

const DESCRIPTION = 'NatsEventBus [connection concealed]';

/**
 * The provider for NATS JetStream.
 *
 * Publishing: one stream capturing `<prefix>.>`, subject = `<prefix>.<event type>`, the event
 * id as message id, and `publish` resolves only when the stream acknowledged every message,
 * so it is a safe target for the outbox relay. Consuming: a durable pull consumer per
 * consumer and event type, acknowledged after the handlers resolved, a bounded number of
 * delayed redeliveries, then a dead-letter stream. Delivery is at least once and unordered:
 * consumers deduplicate.
 */
export class NatsEventBus implements EventBus {
  /** Read by what observes the bus from outside: the name of the transport. */
  readonly messagingSystem = MESSAGING_SYSTEM;

  private readonly settings: Settings;

  private readonly link: BrokerLink;

  private readonly publications: Publications;

  private readonly consumption: Consumption;

  private closed = false;

  constructor(options: NatsEventBusOptions) {
    this.settings = settingsOf(options, connect);
    this.publications = new Publications(this.settings);

    this.consumption = new Consumption(this.publications, {
      ...this.settings,
      topology: topologySettingsOf(this.settings),
      consumerLost: () => {
        this.link.restart();
      },
    });

    this.link = new BrokerLink(this.settings, {
      opened: async (connection) => {
        this.publications.attach(connection);
        await this.consumption.attach(connection);
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
   * Resolves when the stream acknowledged every event, rejects otherwise: nothing is
   * buffered for later, so the caller (the outbox relay) knows what to retry.
   */
  async publish(events: readonly IntegrationEvent[]): Promise<void> {
    if (events.length === 0) {
      return;
    }

    await this.link.opened();
    // The consumers of this bus exist before it publishes: it never misses its own events.
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
   * Connects if needed and creates the streams and the durable consumers of the
   * subscriptions made so far. Idempotent. Resolves once those subscriptions are consuming.
   */
  async assertTopology(): Promise<void> {
    const manager = await jetstreamManager(await this.link.opened());

    await declareTopology(manager, this.describeTopology());
    await this.consumption.started();
  }

  describeTopology(): NatsTopology {
    return topologyOf(topologySettingsOf(this.settings), this.consumption.bindings());
  }

  /**
   * Moves up to `limit` messages of a consumer from the dead-letter stream back to the
   * subject they came from, for that consumer only and with a fresh attempt budget. Returns
   * how many were moved.
   */
  async replayDead(binding: ConsumerBinding, limit = 100): Promise<number> {
    const { stream, subjectPrefix } = this.settings;
    const { durable, subject, deadSubject } = bindingNamesOf(binding, subjectPrefix);
    const { streams, direct } = await jetstreamManager(await this.link.opened());
    let replayed = 0;

    for (let seq = 1; replayed < limit; replayed += 1) {
      const dead = await direct.getMessage(deadStreamOf(stream), { seq, next_by_subj: deadSubject });

      if (dead === null) {
        break;
      }

      // A message id of its own: inside the duplicate window the original id would drop it.
      const copy = { data: dead.data, headers: dead.header, messageId: `${durable}.replay.${String(dead.seq)}` };

      await this.publications.send(subject, republication(copy, { [REPLAY_FOR_HEADER]: durable }));
      await streams.deleteMessage(deadStreamOf(stream), dead.seq);
      seq = dead.seq + 1;
    }

    return replayed;
  }

  /** Stops consuming, waits for the handlers in flight and their acknowledgements, disconnects. */
  async close(): Promise<void> {
    if (this.closed) {
      return;
    }

    this.closed = true;
    await this.consumption.drain();
    await this.link.close();
    this.publications.detach();
  }

  /** What a serialisation shows of the bus: its name, never its connection. */
  toJSON(): string {
    return DESCRIPTION;
  }

  /** What `console.log` and `util.inspect` show of the bus: the same. */
  [inspect.custom](): string {
    return DESCRIPTION;
  }

  /** Adds a handler to the durable consumer of one consumer for one type, and connects if needed. */
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
    stream: settings.stream,
    subjectPrefix: settings.subjectPrefix,
    storage: settings.storage,
    replicas: settings.replicas,
    duplicateWindowMs: settings.duplicateWindowMs,
    ackWaitMs: settings.ackWaitMs,
    maxAttempts: settings.retry.maxAttempts,
  };
}
