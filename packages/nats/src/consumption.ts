import {
  jetstream,
  jetstreamManager,
  type ConsumerMessages,
  type JetStreamClient,
  type JetStreamManager,
  type JsMsg,
} from '@nats-io/jetstream';
import type { NatsConnection } from '@nats-io/transport-node';
import { errorCode } from '@ddd-ts-kit/events';
import type { IntegrationEvent, IntegrationEventCallback, Subscription } from '@ddd-ts-kit/kernel';
import {
  ATTEMPT_HEADER,
  DEAD_REASON_HEADER,
  ERROR_CODE_HEADER,
  REPLAY_FOR_HEADER,
  SOURCE_HEADER,
  decode,
  republication,
} from './codec.js';
import { failureCode } from './errors.js';
import type { NatsDelivery, NatsFailure, RetryOptions } from './options.js';
import type { Publications } from './publications.js';
import {
  bindingNamesOf,
  declareTopology,
  topologyOf,
  type BindingNames,
  type ConsumerBinding,
  type TopologySettings,
} from './topology.js';

export interface ConsumptionSettings {
  readonly topology: TopologySettings;
  readonly prefetch: number;
  readonly retry: Required<RetryOptions>;
  readonly onFailure: (failure: NatsFailure) => void;
  readonly onDelivery: (delivery: NatsDelivery) => void;
  /** Called when a consumer dies while the connection lives. */
  readonly consumerLost: () => void;
}

interface Session {
  readonly client: JetStreamClient;
  readonly manager: JetStreamManager;
}

interface DurableSubscription {
  readonly binding: ConsumerBinding;
  readonly names: BindingNames;
  readonly handlers: Set<IntegrationEventCallback>;
  messages: ConsumerMessages | undefined;
}

interface Delivery {
  readonly subscription: DurableSubscription;
  readonly message: JsMsg;
}

export const POISON_MESSAGE = 'POISON_MESSAGE';

/**
 * The consuming side: one durable pull consumer per consumer and event type, an explicit
 * acknowledgement once every handler resolved, and for a failure a refusal with a delay,
 * then a copy to the dead-letter stream when the attempts are spent. A message is never
 * delivered again at once: no hot loop.
 */
export class Consumption {
  readonly #subscriptions = new Map<string, DurableSubscription>();
  readonly #starting = new Set<Promise<void>>();
  readonly #inFlight = new Set<Promise<void>>();
  #session: Session | undefined;

  constructor(
    private readonly publications: Publications,
    private readonly settings: ConsumptionSettings,
  ) {}

  get inFlight(): number {
    return this.#inFlight.size;
  }

  bindings(): ConsumerBinding[] {
    return [...this.#subscriptions.values()].map((subscription) => subscription.binding);
  }

  add(binding: ConsumerBinding, handler: IntegrationEventCallback): Subscription {
    const subscription = this.#subscriptionOf(binding);
    subscription.handlers.add(handler);
    return {
      unsubscribe: () => {
        this.#remove(subscription, handler);
      },
    };
  }

  async attach(connection: NatsConnection): Promise<void> {
    const session = { client: jetstream(connection), manager: await jetstreamManager(connection) };
    await declareTopology(session.manager, topologyOf(this.settings.topology, []));
    // The map is iterated live: a subscription added meanwhile is started by this loop.
    for (const subscription of this.#subscriptions.values()) {
      await this.#start(session, subscription);
    }
    this.#session = session;
  }

  detach(): void {
    this.#session = undefined;
    for (const subscription of this.#subscriptions.values()) {
      subscription.messages = undefined;
    }
  }

  /** Resolves once the subscriptions made so far are consuming, or have failed to. */
  async started(): Promise<void> {
    while (this.#starting.size > 0) {
      await Promise.allSettled([...this.#starting]);
    }
  }

  /** Stops taking messages, lets the handlers in progress finish and acknowledge. */
  async drain(): Promise<void> {
    this.#session = undefined;
    const pulls = [...this.#subscriptions.values()].map((subscription) => stop(subscription));
    await Promise.allSettled(pulls);
    while (this.#inFlight.size > 0) {
      await Promise.allSettled([...this.#inFlight]);
    }
  }

  #subscriptionOf(binding: ConsumerBinding): DurableSubscription {
    const names = bindingNamesOf(binding, this.settings.topology.subjectPrefix);
    const existing = this.#subscriptions.get(names.durable);
    if (existing !== undefined) {
      return existing;
    }
    const subscription = { binding, names, handlers: new Set<never>(), messages: undefined };
    this.#subscriptions.set(names.durable, subscription);
    if (this.#session !== undefined) {
      track(this.#starting, this.#startOrGiveUp(this.#session, subscription));
    }
    return subscription;
  }

  async #startOrGiveUp(session: Session, subscription: DurableSubscription): Promise<void> {
    try {
      await this.#start(session, subscription);
    } catch (error) {
      this.settings.onFailure({ kind: 'connection', code: failureCode(error) });
      this.settings.consumerLost();
    }
  }

  async #start(session: Session, subscription: DurableSubscription): Promise<void> {
    const { topology, prefetch } = this.settings;
    await declareTopology(session.manager, {
      streams: [],
      consumers: topologyOf(topology, [subscription.binding]).consumers,
    });
    const consumer = await session.client.consumers.get(topology.stream, subscription.names.durable);
    const messages = await consumer.consume({ max_messages: prefetch });
    subscription.messages = messages;
    void this.#pump(subscription, messages);
  }

  /** Hands each message to the handlers, `prefetch` of them at once at most. */
  async #pump(subscription: DurableSubscription, messages: ConsumerMessages): Promise<void> {
    const running = new Set<Promise<void>>();
    try {
      for await (const message of messages) {
        const work = this.#process({ subscription, message });
        track(running, work);
        track(this.#inFlight, work);
        if (running.size >= this.settings.prefetch) {
          await Promise.race(running);
        }
      }
    } catch (error) {
      this.settings.onFailure({ kind: 'connection', code: failureCode(error) });
    }
    if (subscription.messages === messages) {
      // The pull ended by itself (consumer deleted, stream gone): rebuild everything.
      this.settings.consumerLost();
    }
  }

  async #process(delivery: Delivery): Promise<void> {
    const { subscription, message } = delivery;
    const target = message.headers?.get(REPLAY_FOR_HEADER) ?? '';
    if (target !== '' && target !== subscription.names.durable) {
      message.ack();
      return;
    }
    const event = decode(message.data);
    if (event === undefined) {
      await this.#buryPoison(delivery);
    } else if (subscription.handlers.size === 0) {
      message.nak();
    } else {
      await this.#handle(delivery, event);
    }
  }

  async #handle(delivery: Delivery, event: IntegrationEvent): Promise<void> {
    const code = await failureOf(delivery.subscription.handlers, event);
    if (code === undefined) {
      this.#settled(delivery, 'acknowledged');
      delivery.message.ack();
      return;
    }
    await this.#retryOrBury(delivery, event, code);
  }

  async #buryPoison(delivery: Delivery): Promise<void> {
    const consumer = delivery.subscription.names.durable;
    this.settings.onFailure({ kind: 'poison', consumer, code: POISON_MESSAGE });
    this.#settled(delivery, 'poison');
    await this.#bury(delivery, { [ERROR_CODE_HEADER]: POISON_MESSAGE, [DEAD_REASON_HEADER]: 'poison' });
  }

  async #retryOrBury(delivery: Delivery, event: IntegrationEvent, code: string): Promise<void> {
    const { retry, onFailure } = this.settings;
    const consumer = delivery.subscription.names.durable;
    const attempt = delivery.message.info.deliveryCount;
    const dead = attempt >= retry.maxAttempts;
    const { id: eventId, type: eventType } = event;
    onFailure({ kind: 'handler', consumer, eventId, eventType, code, attempt, dead });
    this.#settled(delivery, dead ? 'dead' : 'retried');
    if (dead) {
      const headers = { [ERROR_CODE_HEADER]: code, [DEAD_REASON_HEADER]: 'max-attempts' };
      await this.#bury(delivery, { ...headers, [ATTEMPT_HEADER]: String(attempt) });
    } else {
      delivery.message.nak(retry.delayMs);
    }
  }

  /** Acknowledged copy to the dead-letter stream first, termination second: never lost in between. */
  async #bury({ subscription, message }: Delivery, headers: Record<string, string>): Promise<void> {
    const { stream } = this.settings.topology;
    const { durable, deadSubject } = subscription.names;
    const source = { [SOURCE_HEADER]: `${stream}/${String(message.seq)}` };
    // A redelivery of the same message is the same dead letter: the stream keeps one.
    const copy = { data: message.data, headers: message.headers, messageId: `${durable}.${String(message.seq)}` };
    try {
      await this.publications.send(deadSubject, republication(copy, { ...headers, ...source }));
    } catch {
      message.nak(this.settings.retry.delayMs);
      return;
    }
    message.term();
  }

  #settled({ subscription, message }: Delivery, outcome: NatsDelivery['outcome']): void {
    const consumer = subscription.names.durable;
    this.settings.onDelivery({ consumer, attempt: message.info.deliveryCount, outcome });
  }

  #remove(subscription: DurableSubscription, handler: IntegrationEventCallback): void {
    subscription.handlers.delete(handler);
    if (subscription.handlers.size > 0) {
      return;
    }
    // The durable consumer stays: it keeps its place in the stream, it only stopped reading.
    this.#subscriptions.delete(subscription.names.durable);
    void stop(subscription);
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

function track(set: Set<Promise<void>>, work: Promise<void>): void {
  set.add(work);
  const done = (): void => {
    set.delete(work);
  };
  void work.then(done, done);
}

async function stop(subscription: DurableSubscription): Promise<void> {
  const { messages } = subscription;
  subscription.messages = undefined;
  await messages?.close().catch(ignore);
}

function ignore(): undefined {
  return undefined;
}
