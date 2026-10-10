import type { Redis } from 'ioredis';
import type { IntegrationEvent, IntegrationEventCallback } from '@ddd-ts-kit/kernel';
import {
  ATTEMPT_FIELD,
  CONSUMER_FIELD,
  DEAD_REASON_FIELD,
  ENTRY_ID_FIELD,
  ERROR_CODE_FIELD,
  REPLAY_FOR_FIELD,
  decode,
  type Entry,
} from './codec.js';
import { bury } from './dead-letters.js';
import { failureCode } from './errors.js';
import type { RedisStreamsDelivery, RedisStreamsFailure, RetryOptions } from './options.js';
import { deadStreamOf } from './topology.js';

export interface SettlementSettings {
  /** The consumer name, which is the name of its group. */
  readonly consumer: string;
  readonly instance: string;
  readonly retry: Required<RetryOptions>;
  readonly onFailure: (failure: RedisStreamsFailure) => void;
  readonly onDelivery: (delivery: RedisStreamsDelivery) => void;
}

/** One entry handed to this process, with the number of times the group delivered it. */
export interface Delivery {
  readonly stream: string;
  readonly entry: Entry;
  readonly attempt: number;
}

export const POISON_ENTRY = 'POISON_ENTRY';
/** The code of an entry that used its deliveries up without a handler answering: its consumers crashed on it. */
export const ATTEMPTS_EXHAUSTED = 'ATTEMPTS_EXHAUSTED';

/**
 * What becomes of a delivered entry: acknowledged once every handler resolved; left pending
 * after a failure, to be claimed again after the delay; copied to the dead stream when its
 * attempts are spent or when it does not hold an envelope.
 */
export class Settlement {
  constructor(
    private readonly client: Redis,
    private readonly settings: SettlementSettings,
  ) {}

  /** Never rejects: an entry that could not be settled stays pending and is delivered again. */
  async settle(delivery: Delivery, handlers: ReadonlySet<IntegrationEventCallback>): Promise<void> {
    try {
      await this.#decide(delivery, handlers);
    } catch {
      return;
    }
  }

  async #decide(delivery: Delivery, handlers: ReadonlySet<IntegrationEventCallback>): Promise<void> {
    if (this.#isForAnotherConsumer(delivery.entry)) {
      await this.#acknowledge(delivery);
      return;
    }
    const event = decode(delivery.entry);
    if (event === undefined) {
      await this.#buryPoison(delivery);
    } else if (delivery.attempt > this.settings.retry.maxAttempts) {
      await this.#fail(delivery, event, ATTEMPTS_EXHAUSTED);
    } else if (handlers.size > 0) {
      await this.#handle(delivery, event, handlers);
    }
  }

  /** A replayed dead entry is addressed to the consumer it died for. */
  #isForAnotherConsumer(entry: Entry): boolean {
    const addressee = entry.fields.get(REPLAY_FOR_FIELD);
    return addressee !== undefined && addressee !== this.settings.consumer;
  }

  async #acknowledge({ stream, entry }: Delivery): Promise<void> {
    await this.client.xack(stream, this.settings.consumer, entry.id);
  }

  async #buryPoison(delivery: Delivery): Promise<void> {
    const { stream } = delivery;
    this.settings.onFailure({ kind: 'poison', stream, consumer: this.settings.consumer, code: POISON_ENTRY });
    this.#settled(delivery, 'poison');
    await this.#bury(delivery, { [ERROR_CODE_FIELD]: POISON_ENTRY, [DEAD_REASON_FIELD]: 'poison' });
  }

  async #handle(delivery: Delivery, event: IntegrationEvent, handlers: ReadonlySet<IntegrationEventCallback>): Promise<void> {
    const code = await failureOf(handlers, event);
    if (code === undefined) {
      this.#settled(delivery, 'acknowledged');
      await this.#acknowledge(delivery);
    } else {
      await this.#fail(delivery, event, code);
    }
  }

  async #fail(delivery: Delivery, event: IntegrationEvent, code: string): Promise<void> {
    const { stream, attempt } = delivery;
    const { consumer, retry } = this.settings;
    const dead = attempt >= retry.maxAttempts;
    this.settings.onFailure({ kind: 'handler', stream, consumer, eventId: event.id, eventType: event.type, code, attempt, dead });
    this.#settled(delivery, dead ? 'dead' : 'retried');
    if (dead) {
      await this.#bury(delivery, { [ERROR_CODE_FIELD]: code, [DEAD_REASON_FIELD]: 'max-attempts' });
    } else {
      await this.#postpone(delivery);
    }
  }

  #settled({ stream, attempt }: Delivery, outcome: RedisStreamsDelivery['outcome']): void {
    this.settings.onDelivery({ stream, consumer: this.settings.consumer, attempt, outcome });
  }

  async #bury(delivery: Delivery, reason: Readonly<Record<string, string>>): Promise<void> {
    const { stream, entry, attempt } = delivery;
    const { consumer } = this.settings;
    const annotations = { ...reason, [ATTEMPT_FIELD]: String(attempt), [CONSUMER_FIELD]: consumer, [ENTRY_ID_FIELD]: entry.id };
    await bury(this.client, { stream, group: consumer, deadStream: deadStreamOf(stream, consumer), entry, annotations });
  }

  /**
   * The entry stays pending; claiming it for ourselves without reading it (`JUSTID`) restarts
   * its idle time and leaves its delivery counter alone, so the retry delay runs from the
   * failure, not from the delivery.
   */
  async #postpone({ stream, entry }: Delivery): Promise<void> {
    await this.client.xclaim(stream, this.settings.consumer, this.settings.instance, 0, entry.id, 'JUSTID');
  }
}

/** Runs every handler, so one that fails does not starve the others; gives the first code. */
async function failureOf(handlers: ReadonlySet<IntegrationEventCallback>, event: IntegrationEvent): Promise<string | undefined> {
  let code: string | undefined;
  for (const handler of [...handlers]) {
    try {
      await handler(event);
    } catch (error) {
      code ??= failureCode(error);
    }
  }
  return code;
}
