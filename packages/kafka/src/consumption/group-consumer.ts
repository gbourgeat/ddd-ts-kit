import type { KafkaJS } from '@confluentinc/kafka-javascript';
import type { IntegrationEventCallback, Subscription } from '@ddd-ts-kit/kernel';
import type { BrokerLink } from '../connection/broker-link.js';
import type { Rebalance } from '../connection/rebalance.js';
import { reasonOf } from '../errors/reason-of.js';
import { ignore } from '../ignore.js';
import type { KafkaDelivery } from '../options/kafka-delivery.js';
import type { KafkaFailure } from '../options/kafka-failure.js';
import type { ReconnectOptions } from '../options/reconnect-options.js';
import type { RetryOptions } from '../options/retry-options.js';
import type { Publications } from '../publication/publications.js';
import type { KafkaTopology } from '../topology/kafka-topology.js';
import { topologyOf } from '../topology/topology-of.js';
import type { TopologySettings } from '../topology/topology-settings.js';
import { Backoff } from './backoff.js';
import { postpone } from './postpone.js';
import { RecordHandling } from './record-handling.js';
import { Timers } from './timers.js';

interface GroupSettings {
  readonly topology: TopologySettings;
  readonly concurrency: number;
  readonly retry: Required<RetryOptions>;
  readonly reconnect: Required<ReconnectOptions>;
  readonly onFailure: (failure: KafkaFailure) => void;
  readonly onDelivery: (delivery: KafkaDelivery) => void;
}

export interface GroupDependencies {
  readonly link: BrokerLink;
  readonly publications: Publications;
  readonly settings: GroupSettings;
}

/**
 * One consuming context: a member of the consumer group named after it. It joins the group,
 * subscribes to the topics of its event types as they are added, starts again after a delay
 * when the cluster fails it, and hands each record it reads to its `RecordHandling`.
 */
export class GroupConsumer {
  private readonly topics = new Set<string>();

  private readonly subscribed = new Set<string>();

  private readonly timers = new Timers();

  private readonly backoff: Backoff;

  private readonly records: RecordHandling;

  private client: KafkaJS.Consumer | undefined;

  private running = false;

  private work: Promise<void> = Promise.resolve();

  private joined: Promise<void> = Promise.resolve();

  private join: () => void = ignore;

  private draining = false;

  constructor(
    readonly name: string,
    private readonly dependencies: GroupDependencies,
  ) {
    const { publications, settings } = dependencies;

    this.backoff = new Backoff(settings.reconnect);

    this.records = new RecordHandling(name, {
      publications,
      retry: settings.retry,
      backoff: this.backoff,
      timers: this.timers,
      commit: async (position) => {
        await this.client?.commitOffsets([position]);
      },
      onFailure: settings.onFailure,
      onDelivery: settings.onDelivery,
    });
  }

  get inFlight(): number {
    return this.records.inFlight;
  }

  get partitionsAssigned(): number {
    return this.client?.assignment().length ?? 0;
  }

  types(): string[] {
    return this.records.types();
  }

  add(type: string, handler: IntegrationEventCallback): Subscription {
    const subscription = this.records.add(type, handler);

    this.topics.add(this.dependencies.settings.topology.topicOf(type));
    this.synchronize();

    return subscription;
  }

  /** Resolves once the group has its partitions for the subscriptions made so far, or failed to. */
  async started(): Promise<void> {
    await this.work;
    await this.joined;
  }

  /** Stops reading, lets the handlers in progress finish and commit, leaves the group. */
  async drain(): Promise<void> {
    this.draining = true;
    this.timers.cancel();
    this.records.abandonWaiting();
    await this.work;
    // The client stays until it has left: the handlers in progress still commit through it.
    await this.client?.disconnect().catch(ignore);
    this.client = undefined;
  }

  private synchronize(): void {
    this.work = this.work.then(() => this.subscribePending());
  }

  private async subscribePending(): Promise<void> {
    const pending = [...this.topics].filter((topic) => !this.subscribed.has(topic));

    if (this.draining || pending.length === 0) {
      return;
    }

    try {
      await this.dependencies.link.declare(this.topology().topics);
      const client = await this.connected();

      this.joined = new Promise((resolve) => {
        this.join = resolve;
      });

      await client.subscribe({ topics: pending });
      await this.run(client);
      pending.forEach((topic) => this.subscribed.add(topic));
      this.backoff.reset();
    } catch (error) {
      this.restartLater(reasonOf(error));
    }
  }

  private topology(): KafkaTopology {
    const bindings = this.types().map((type) => ({ consumer: this.name, type }));

    return topologyOf({ ...this.dependencies.settings.topology, publishedTypes: [] }, bindings);
  }

  private async connected(): Promise<KafkaJS.Consumer> {
    const { link } = this.dependencies;

    this.client ??= await link.connected(
      link.consumer(this.name, (rebalance) => {
        this.rebalanced(rebalance);
      }),
    );

    return this.client;
  }

  private rebalanced({ assigned, partitions }: Rebalance): void {
    if (assigned) {
      this.join();

      return;
    }

    this.records.forget(partitions);
  }

  private async run(client: KafkaJS.Consumer): Promise<void> {
    if (this.running) {
      return;
    }

    this.running = true;

    await client.run({
      partitionsConsumedConcurrently: this.dependencies.settings.concurrency,
      eachMessage: (delivery) => this.deliver(delivery),
    });
  }

  private async deliver(delivery: KafkaJS.EachMessagePayload): Promise<void> {
    if (this.draining) {
      postpone(delivery, ignore);
    }

    await this.records.deliver(delivery);
  }

  private restartLater(code: string): void {
    this.dependencies.settings.onFailure({ kind: 'connection', code });
    const client = this.client;

    this.client = undefined;
    this.running = false;
    this.subscribed.clear();
    void client?.disconnect().catch(ignore);
    this.join();

    this.timers.later(() => {
      this.synchronize();
    }, this.backoff.delayMs);

    this.backoff.failed();
  }
}
