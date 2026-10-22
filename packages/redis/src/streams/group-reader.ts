import type { Redis } from 'ioredis';
import { inEventScope, type IntegrationEventCallback, type Subscription } from '@ddd-ts-kit/kernel';
import { closeRedis } from '../connection/close-redis';
import { claimDue, type RedeliverySettings } from './claim-due';
import { entriesByStream } from './codec/entries-by-stream';
import type { Delivery } from './delivery';
import { BrokerUnavailableError } from './errors/broker-unavailable-error';
import { EventBusClosedError } from './errors/event-bus-closed-error';
import { failureCode } from './errors/failure-code';
import { reconnectDelay } from './options/reconnect-delay';
import type { Settings } from './options/settings';
import type { ServerLink } from './server-link';
import { Settlement } from './settlement';
import type { ConsumerBinding } from './topology/consumer-binding';
import { createGroup } from './topology/create-group';
import { groupOf } from './topology/group-of';

interface StreamSubscription {
  readonly type: string;
  readonly handlers: Set<IntegrationEventCallback>;
}

const NO_HANDLER: ReadonlySet<IntegrationEventCallback> = new Set();

/**
 * One consumer on its dedicated connection: a blocking read must not hold up the connection
 * that publishes and acknowledges. The consumer is a group on each stream it subscribed to,
 * and this process one member of it. A turn takes back the pending entries that are due, then
 * waits for new ones for a bounded time; the entries of a stream are handled in their order,
 * one at a time.
 */
export class GroupReader {
  private readonly subscriptions = new Map<string, StreamSubscription>();

  private readonly declared = new Set<string>();

  private readonly settlement: Settlement;

  private running: Promise<void> | undefined;

  private interrupt: (() => void) | undefined;

  private stopping = false;

  private unsettled = 0;

  private failures = 0;

  private sweptAt = 0;

  constructor(
    private readonly consumer: string,
    private readonly link: ServerLink,
    private readonly settings: Settings,
  ) {
    this.settlement = new Settlement(link.client, { ...settings, consumer });
  }

  /** Entries read by this reader and not settled yet. */
  get inFlight(): number {
    return this.unsettled;
  }

  get idle(): boolean {
    return this.subscriptions.size === 0;
  }

  bindings(): ConsumerBinding[] {
    return [...this.subscriptions.values()].map(({ type }) => ({ consumer: this.consumer, type }));
  }

  subscribe(type: string, handler: IntegrationEventCallback): Subscription {
    const stream = this.settings.streamOf(type);
    const subscription = this.subscriptions.get(stream) ?? { type, handlers: new Set() };
    const { scope } = this.settings;
    const scoped = scope === undefined ? handler : inEventScope(scope, { consumer: this.consumer }, handler);

    subscription.handlers.add(scoped);
    this.subscriptions.set(stream, subscription);
    this.running ??= this.run();

    return {
      unsubscribe: () => {
        this.remove(stream, scoped);
      },
    };
  }

  /** Creates the group on every stream subscribed to so far that does not have it yet. */
  async declare(client: Redis): Promise<void> {
    for (const { consumer, type } of this.bindings()) {
      const group = groupOf(this.settings, { consumer, type });

      if (!this.declared.has(group.stream)) {
        await createGroup(client, group);
        this.declared.add(group.stream);
      }
    }
  }

  /** Reads nothing more, lets the batch in progress finish and settle, then leaves the group. */
  async stop(): Promise<void> {
    this.stopping = true;
    this.interrupt?.();
    await this.running;
  }

  // The group stays, with its position: the consumer keeps accumulating, it only stopped reading.
  private remove(stream: string, handler: IntegrationEventCallback): void {
    const subscription = this.subscriptions.get(stream);

    subscription?.handlers.delete(handler);

    if (subscription?.handlers.size === 0) {
      this.subscriptions.delete(stream);
    }
  }

  private async run(): Promise<void> {
    const reader = this.link.reader();

    while (!this.stopping) {
      try {
        await this.turn(reader);
        this.failures = 0;
      } catch (error) {
        await this.recover(error);
      }
    }

    await this.leave(reader);
  }

  private async turn(reader: Redis): Promise<void> {
    await this.declare(await this.link.ready());

    const streams = [...this.subscriptions.keys()];

    if (this.sweepIsDue()) {
      const due = await Promise.all(streams.map((stream) => claimDue(reader, stream, this.redelivery())));

      await this.handle(due.flat());
    }

    if (!this.stopping && streams.length > 0) {
      await this.handle(await this.read(reader, streams));
    }
  }

  private sweepIsDue(): boolean {
    const { blockMs, retry } = this.settings;

    if (Date.now() - this.sweptAt < Math.min(blockMs, retry.delayMs)) {
      return false;
    }

    this.sweptAt = Date.now();

    return true;
  }

  private redelivery(): RedeliverySettings {
    const { instance, batchSize, retry } = this.settings;
    // Never below the retry delay: an entry waiting for its retry is not an abandoned one.
    const visibilityTimeoutMs = Math.max(this.settings.visibilityTimeoutMs, retry.delayMs);

    return { consumer: this.consumer, instance, batchSize, retryDelayMs: retry.delayMs, visibilityTimeoutMs };
  }

  private async handle(deliveries: readonly Delivery[]): Promise<void> {
    this.unsettled += deliveries.length;

    const streams = [...new Set(deliveries.map((delivery) => delivery.stream))];

    await Promise.all(
      streams.map((stream) => this.inOrder(deliveries.filter((delivery) => delivery.stream === stream))),
    );
  }

  private async inOrder(deliveries: readonly Delivery[]): Promise<void> {
    for (const delivery of deliveries) {
      const handlers = this.subscriptions.get(delivery.stream)?.handlers ?? NO_HANDLER;

      await this.settlement.settle(delivery, handlers);
      this.unsettled -= 1;
    }
  }

  private async read(reader: Redis, streams: readonly string[]): Promise<Delivery[]> {
    const { instance, batchSize, blockMs } = this.settings;
    const ids = streams.map(() => '>');

    // The named command, not `call`: ioredis maps the reply of the commands it knows to its classic shape.
    const reply = await reader.xreadgroup(
      'GROUP',
      this.consumer,
      instance,
      'COUNT',
      batchSize,
      'BLOCK',
      blockMs,
      'STREAMS',
      ...streams,
      ...ids,
    );

    return [...entriesByStream(reply)].flatMap(([stream, entries]) =>
      entries.map((entry) => ({ stream, entry, attempt: 1 })),
    );
  }

  /**
   * After a failure the groups are created again before the next read: a server that came
   * back without its data has lost them. The link already reported a connection that is down.
   */
  private async recover(error: unknown): Promise<void> {
    this.declared.clear();

    if (!(error instanceof BrokerUnavailableError) && !(error instanceof EventBusClosedError)) {
      this.settings.onFailure({ kind: 'connection', code: failureCode(error) });
    }

    this.failures += 1;
    await this.rest(reconnectDelay(this.settings.reconnect, this.failures));
  }

  private rest(ms: number): Promise<void> {
    if (this.stopping) {
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      const timer = setTimeout(resolve, ms);

      this.interrupt = () => {
        clearTimeout(timer);
        resolve();
      };
    });
  }

  private async leave(reader: Redis): Promise<void> {
    await this.retire().catch(() => undefined);
    await closeRedis(reader);
  }

  /**
   * Removes this process from its groups, where it leaves nothing pending: deleting a
   * consumer drops its pending entries, and those must stay for another instance to claim.
   */
  private async retire(): Promise<void> {
    const { client } = this.link;
    const { instance } = this.settings;

    for (const stream of this.declared) {
      const pending = await client.xpending(stream, this.consumer, '-', '+', 1, instance);

      if (pending.length === 0) {
        await client.xgroup('DELCONSUMER', stream, this.consumer, instance);
      }
    }
  }
}
