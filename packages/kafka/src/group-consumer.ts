import type { KafkaJS } from '@confluentinc/kafka-javascript';
import { errorCode } from '@ddd-ts-kit/events';
import type { IntegrationEvent, IntegrationEventCallback, Subscription } from '@ddd-ts-kit/kernel';
import { Attempts } from './attempts.js';
import type { BrokerLink, Rebalance } from './broker-link.js';
import {
  ATTEMPT_HEADER,
  DEAD_REASON_HEADER,
  ERROR_CODE_HEADER,
  REPLAY_FOR_HEADER,
  SOURCE_HEADER,
  decode,
  republication,
  sourceOf,
  textHeader,
} from './codec.js';
import { reasonOf } from './errors.js';
import { backoffOf, type KafkaDelivery, type KafkaFailure, type ReconnectOptions, type RetryOptions } from './options.js';
import type { Publications } from './publications.js';
import { deadTopicOf, topologyOf, type TopologySettings } from './topology.js';

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

type Delivery = KafkaJS.EachMessagePayload;

export const POISON_MESSAGE = 'POISON_MESSAGE';

/**
 * Tells the client that a record was not handled: it reads the record again once the
 * partition, paused beforehand, is resumed. Its message says nothing about the event.
 */
class DeliveryPostponed extends Error {
  readonly code = 'DELIVERY_POSTPONED';

  constructor() {
    super('The delivery is postponed');
    this.name = 'DeliveryPostponed';
  }
}

/**
 * One consuming context: a member of the consumer group named after it. An offset is
 * committed once every handler of the record resolved, never before. A record whose handler
 * fails keeps its place: its partition is paused for the delay and the record is read again,
 * so the records of a key stay in order, and after the last attempt it is copied to the
 * dead-letter topic and the partition moves on.
 */
export class GroupConsumer {
  readonly #handlers = new Map<string, Set<IntegrationEventCallback>>();
  readonly #topics = new Set<string>();
  readonly #subscribed = new Set<string>();
  readonly #attempts = new Attempts();
  readonly #timers = new Set<ReturnType<typeof setTimeout>>();
  readonly #waitingForHandlers = new Set<() => void>();
  #client: KafkaJS.Consumer | undefined;
  #running = false;
  #work: Promise<void> = Promise.resolve();
  #joined: Promise<void> = Promise.resolve();
  #join: () => void = ignore;
  #failures = 0;
  #inFlight = 0;
  #draining = false;

  constructor(
    readonly name: string,
    private readonly dependencies: GroupDependencies,
  ) {}

  get inFlight(): number {
    return this.#inFlight;
  }

  get partitionsAssigned(): number {
    return this.#client?.assignment().length ?? 0;
  }

  types(): string[] {
    return [...this.#handlers.keys()];
  }

  add(type: string, handler: IntegrationEventCallback): Subscription {
    const handlers = this.#handlers.get(type) ?? new Set();
    this.#handlers.set(type, handlers.add(handler));
    this.#topics.add(this.dependencies.settings.topology.topicOf(type));
    this.#resumeWaiting();
    this.#synchronize();
    return {
      // The group keeps its place in the log: the consumer only stopped reading.
      unsubscribe: () => {
        handlers.delete(handler);
      },
    };
  }

  /** Resolves once the group has its partitions for the subscriptions made so far, or failed to. */
  async started(): Promise<void> {
    await this.#work;
    await this.#joined;
  }

  /** Stops reading, lets the handlers in progress finish and commit, leaves the group. */
  async drain(): Promise<void> {
    this.#draining = true;
    for (const timer of this.#timers) {
      clearTimeout(timer);
    }
    this.#waitingForHandlers.clear();
    await this.#work;
    // The client stays until it has left: the handlers in progress still commit through it.
    await this.#client?.disconnect().catch(ignore);
    this.#client = undefined;
  }

  #resumeWaiting(): void {
    for (const resume of this.#waitingForHandlers) {
      resume();
    }
    this.#waitingForHandlers.clear();
  }

  #synchronize(): void {
    this.#work = this.#work.then(() => this.#subscribePending());
  }

  async #subscribePending(): Promise<void> {
    const pending = [...this.#topics].filter((topic) => !this.#subscribed.has(topic));
    if (this.#draining || pending.length === 0) {
      return;
    }
    try {
      await this.dependencies.link.declare(this.#topologyOf().topics);
      const client = await this.#connected();
      this.#joined = new Promise((resolve) => {
        this.#join = resolve;
      });
      await client.subscribe({ topics: pending });
      await this.#run(client);
      pending.forEach((topic) => this.#subscribed.add(topic));
      this.#failures = 0;
    } catch (error) {
      this.#restartLater(reasonOf(error));
    }
  }

  #topologyOf(): ReturnType<typeof topologyOf> {
    const bindings = this.types().map((type) => ({ consumer: this.name, type }));
    return topologyOf({ ...this.dependencies.settings.topology, publishedTypes: [] }, bindings);
  }

  async #connected(): Promise<KafkaJS.Consumer> {
    const { link } = this.dependencies;
    this.#client ??= await link.connected(link.consumer(this.name, (rebalance) => {
      this.#rebalanced(rebalance);
    }));
    return this.#client;
  }

  #rebalanced({ assigned, partitions }: Rebalance): void {
    if (assigned) {
      this.#join();
      return;
    }
    for (const partition of partitions) {
      this.#attempts.forget(partition);
    }
  }

  async #run(client: KafkaJS.Consumer): Promise<void> {
    if (this.#running) {
      return;
    }
    this.#running = true;
    await client.run({
      partitionsConsumedConcurrently: this.dependencies.settings.concurrency,
      eachMessage: (delivery) => this.#deliver(delivery),
    });
  }

  #restartLater(code: string): void {
    const { reconnect, onFailure } = this.dependencies.settings;
    onFailure({ kind: 'connection', code });
    const client = this.#client;
    this.#client = undefined;
    this.#running = false;
    this.#subscribed.clear();
    void client?.disconnect().catch(ignore);
    this.#join();
    this.#later(() => {
      this.#synchronize();
    }, backoffOf(reconnect, this.#failures));
    this.#failures += 1;
  }

  #later(act: () => void, delayMs: number): void {
    const timer = setTimeout(() => {
      this.#timers.delete(timer);
      act();
    }, delayMs);
    this.#timers.add(timer);
  }

  async #deliver(delivery: Delivery): Promise<void> {
    this.#inFlight += 1;
    try {
      await this.#process(delivery);
    } finally {
      this.#inFlight -= 1;
    }
  }

  async #process(delivery: Delivery): Promise<void> {
    if (this.#draining) {
      postpone(delivery, ignore);
    }
    if (this.#isForAnotherConsumer(delivery)) {
      await this.#commit(delivery);
      return;
    }
    const event = decode(delivery.message.value);
    if (event === undefined) {
      await this.#buryPoison(delivery);
      return;
    }
    const handlers = this.#handlers.get(event.type);
    if (handlers === undefined) {
      // A type this consumer never subscribed to, on a topic that carries several.
      await this.#commit(delivery);
      return;
    }
    await this.#handle(delivery, event, handlers);
  }

  /** A replayed dead letter is on the topic for the one consumer that had given up on it. */
  #isForAnotherConsumer(delivery: Delivery): boolean {
    const target = textHeader(delivery, REPLAY_FOR_HEADER);
    return target !== undefined && target !== this.name;
  }

  async #handle(
    delivery: Delivery,
    event: IntegrationEvent,
    handlers: ReadonlySet<IntegrationEventCallback>,
  ): Promise<void> {
    if (handlers.size === 0) {
      postpone(delivery, (resume) => this.#waitingForHandlers.add(resume));
    }
    const code = await failureOf(handlers, event);
    if (code === undefined) {
      this.#settled(delivery, 'acknowledged');
      await this.#commit(delivery);
    } else {
      await this.#retryOrBury(delivery, event, code);
    }
  }

  async #retryOrBury(delivery: Delivery, event: IntegrationEvent, code: string): Promise<void> {
    const { retry, onFailure } = this.dependencies.settings;
    const attempt = this.#attempts.of(delivery);
    const dead = attempt >= retry.maxAttempts;
    const { id: eventId, type: eventType } = event;
    const { name: consumer } = this;
    onFailure({ kind: 'handler', consumer, topic: delivery.topic, eventId, eventType, code, attempt, dead });
    this.#settled(delivery, dead ? 'dead' : 'retried');
    if (dead) {
      const headers = { [ERROR_CODE_HEADER]: code, [DEAD_REASON_HEADER]: 'max-attempts' };
      await this.#bury(delivery, { ...headers, [ATTEMPT_HEADER]: String(attempt) });
      return;
    }
    this.#attempts.failed(delivery);
    postpone(delivery, (resume) => {
      this.#later(resume, retry.delayMs);
    });
  }

  async #buryPoison(delivery: Delivery): Promise<void> {
    const { name: consumer } = this;
    const { topic } = delivery;
    this.dependencies.settings.onFailure({ kind: 'poison', consumer, topic, code: POISON_MESSAGE });
    this.#settled(delivery, 'poison');
    await this.#bury(delivery, { [ERROR_CODE_HEADER]: POISON_MESSAGE, [DEAD_REASON_HEADER]: 'poison' });
  }

  /** Acknowledged copy to the dead-letter topic first, commit second: never lost in between. */
  async #bury(delivery: Delivery, headers: Record<string, string>): Promise<void> {
    const dead = deadTopicOf(this.name, delivery.topic);
    const source = { [SOURCE_HEADER]: sourceOf(delivery) };
    try {
      await this.dependencies.publications.send(republication(delivery, dead, { ...headers, ...source }));
    } catch (error) {
      this.#postponeAfter(delivery, error);
    }
    await this.#commit(delivery);
  }

  async #commit(delivery: Delivery): Promise<void> {
    const { topic, partition, message } = delivery;
    const offset = String(BigInt(message.offset) + 1n);
    this.#attempts.forget(delivery);
    try {
      await this.#client?.commitOffsets([{ topic, partition, offset }]);
      this.#failures = 0;
    } catch (error) {
      this.#postponeAfter(delivery, error);
    }
  }

  // The partition must not move past a record that is neither committed nor parked.
  #postponeAfter(delivery: Delivery, error: unknown): never {
    const { reconnect, onFailure } = this.dependencies.settings;
    onFailure({ kind: 'connection', code: reasonOf(error) });
    const delay = backoffOf(reconnect, this.#failures);
    this.#failures += 1;
    postpone(delivery, (resume) => {
      this.#later(resume, delay);
    });
  }

  #settled(delivery: Delivery, outcome: KafkaDelivery['outcome']): void {
    const { topic, partition } = delivery;
    const attempt = this.#attempts.of(delivery);
    this.dependencies.settings.onDelivery({ consumer: this.name, topic, partition, attempt, outcome });
  }
}

/** Runs every handler, so one that fails does not starve the others; gives the first code. */
async function failureOf(
  handlers: ReadonlySet<IntegrationEventCallback>,
  event: IntegrationEvent,
): Promise<string | undefined> {
  let code: string | undefined;
  for (const handler of [...handlers]) {
    try {
      await handler(event);
    } catch (error) {
      code ??= errorCode(error);
    }
  }
  return code;
}

/**
 * Pauses the partition of the record and hands `release` the way to resume it. Throwing is
 * how the client is told to read the record again instead of moving to the next one.
 */
function postpone(delivery: Delivery, release: (resume: () => void) => void): never {
  release(quietly(pausing(delivery)));
  throw new DeliveryPostponed();
}

// Pausing or resuming a partition the group took back throws: the new owner reads the record.
function pausing(delivery: Delivery): () => void {
  try {
    return delivery.pause();
  } catch {
    return ignore;
  }
}

function quietly(act: () => void): () => void {
  return () => {
    try {
      act();
    } catch {
      return;
    }
  };
}

function ignore(): undefined {
  return undefined;
}
