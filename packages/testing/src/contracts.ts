import { CONCURRENCY_CONFLICT } from '@ddd-ts-kit/kernel';
import type {
  AggregateRoot,
  EventBus,
  IntegrationEvent,
  ProcessedEventStore,
  Repository,
} from '@ddd-ts-kit/kernel';
import { ContractSuite, type Awaitable, type ContractRunner } from './contracts/suite.js';

export { ContractSuite, type Awaitable, type ContractRunner } from './contracts/suite.js';
export { cacheContract, type CacheContractOptions } from './contracts/cache-contract.js';
export { lockContract, type LockContractOptions } from './contracts/lock-contract.js';
export {
  jobSchedulerContract,
  type JobSchedulerContractOptions,
  type JobSchedulerUnderContract,
} from './contracts/job-scheduler-contract.js';
export { rateLimiterContract, type RateLimiterContractOptions } from './contracts/rate-limiter-contract.js';

export interface RepositoryContractOptions<A extends AggregateRoot<Id>, Id extends string | number> {
  readonly name: string;
  /** A fresh, empty repository; called before each test. */
  createRepository(): Awaitable<Repository<A, Id>>;
  /** A new valid aggregate with an id of its own at each call. */
  createAggregate(): A;
  /** Any business operation that changes what `stateOf` returns. */
  mutate(aggregate: A): void;
  idOf(aggregate: A): Id;
  /** A plain-data view of the business state (not of `version`), compared with `toEqual`. */
  stateOf(aggregate: A): unknown;
}

/** What every repository, fake or real, guarantees to the application layer. */
export function repositoryContract<A extends AggregateRoot<Id>, Id extends string | number = string>(
  runner: ContractRunner,
  options: RepositoryContractOptions<A, Id>,
): void {
  new RepositorySuite(runner, options).describe(`${options.name} (repository contract)`);
}

class RepositorySuite<
  A extends AggregateRoot<Id>,
  Id extends string | number,
> extends ContractSuite<Repository<A, Id>> {
  constructor(
    runner: ContractRunner,
    private readonly options: RepositoryContractOptions<A, Id>,
  ) {
    super(runner, () => options.createRepository());
  }

  protected tests(): void {
    this.findsWhatWasSaved();
    this.keepsAggregatesApart();
    this.storesTheChangesOfLaterSaves();
    this.ignoresWhatWasNotSaved();
    this.refusesToOverwriteAnUnseenChange();
  }

  private findsWhatWasSaved(): void {
    const { options } = this;

    this.it('finds a saved aggregate with the state it was saved in', async () => {
      const aggregate = options.createAggregate();
      await this.subject.save(aggregate);

      const found = await this.reload(aggregate);

      this.expect(options.idOf(found)).toBe(options.idOf(aggregate));
      this.expect(options.stateOf(found)).toEqual(options.stateOf(aggregate));
    });

    this.it('gives undefined for an id that was never saved', async () => {
      await this.subject.save(options.createAggregate());

      const unknownId = options.idOf(options.createAggregate());
      this.expect(await this.subject.findById(unknownId)).toBe(undefined);
    });
  }

  private keepsAggregatesApart(): void {
    const { options } = this;

    this.it('keeps aggregates apart', async () => {
      const first = options.createAggregate();
      const second = options.createAggregate();
      options.mutate(second);
      await this.subject.save(first);
      await this.subject.save(second);

      this.expect(options.stateOf(await this.reload(first))).toEqual(options.stateOf(first));
      this.expect(options.stateOf(await this.reload(second))).toEqual(options.stateOf(second));
    });
  }

  private storesTheChangesOfLaterSaves(): void {
    const { options } = this;

    this.it('stores the changes of a loaded aggregate that is saved again', async () => {
      const aggregate = options.createAggregate();
      await this.subject.save(aggregate);

      const loaded = await this.reload(aggregate);
      options.mutate(loaded);
      await this.subject.save(loaded);

      this.expect(options.stateOf(await this.reload(aggregate))).toEqual(options.stateOf(loaded));
    });

    this.it('accepts several saves of the same instance in a row', async () => {
      const aggregate = options.createAggregate();
      await this.subject.save(aggregate);
      options.mutate(aggregate);
      await this.subject.save(aggregate);

      this.expect(options.stateOf(await this.reload(aggregate))).toEqual(options.stateOf(aggregate));
    });
  }

  private ignoresWhatWasNotSaved(): void {
    const { options } = this;

    this.it('is not affected by a mutation that is not saved', async () => {
      const aggregate = options.createAggregate();
      // Copied: `stateOf` may hand out a live view of the aggregate about to be mutated.
      const saved = structuredClone(options.stateOf(aggregate));
      await this.subject.save(aggregate);

      options.mutate(aggregate);
      options.mutate(await this.reload(aggregate));

      this.expect(options.stateOf(await this.reload(aggregate))).toEqual(saved);
    });
  }

  private refusesToOverwriteAnUnseenChange(): void {
    const { options } = this;

    this.it('refuses to overwrite a change it has not seen', async () => {
      const aggregate = options.createAggregate();
      await this.subject.save(aggregate);
      const mine = await this.reload(aggregate);
      const theirs = await this.reload(aggregate);

      options.mutate(theirs);
      await this.subject.save(theirs);
      const failure = await failureOf(() => this.subject.save(mine));

      this.expect(codeOf(failure)).toBe(CONCURRENCY_CONFLICT);
      this.expect(options.stateOf(await this.reload(aggregate))).toEqual(options.stateOf(theirs));
    });
  }

  private async reload(aggregate: A): Promise<A> {
    const found = await this.subject.findById(this.options.idOf(aggregate));
    if (found === undefined) {
      throw new Error('The saved aggregate was not found');
    }
    return found;
  }
}

async function failureOf(work: () => Promise<unknown>): Promise<unknown> {
  try {
    await work();
  } catch (error) {
    // A thrown `undefined` would read as "no failure".
    return error ?? new Error('rejected without a reason');
  }
  return undefined;
}

function codeOf(error: unknown): unknown {
  return typeof error === 'object' && error !== null && 'code' in error ? error.code : undefined;
}

export interface EventBusUnderContract {
  readonly bus: EventBus;
  /**
   * Resolves once everything published so far has been delivered (or given up on). Needed by
   * providers that deliver asynchronously; in-process buses leave it out.
   */
  settle?(): Promise<void>;
  close?(): Promise<void>;
}

export interface EventBusContractOptions {
  readonly name: string;
  /** A fresh bus with no subscriber; called before each test. */
  createBus(): Awaitable<EventBusUnderContract>;
}

/**
 * What every integration event provider guarantees. Delivery is at-least-once: the suite
 * accepts redeliveries everywhere and never relies on the order of arrival.
 */
export function eventBusContract(runner: ContractRunner, options: EventBusContractOptions): void {
  new EventBusSuite(runner, options).describe(`${options.name} (event bus contract)`);
}

const HAPPENED = 'contract.thing.happened';
const IGNORED = 'contract.thing.ignored';

class EventBusSuite extends ContractSuite<EventBusUnderContract> {
  constructor(runner: ContractRunner, options: EventBusContractOptions) {
    super(runner, () => options.createBus());
  }

  protected tests(): void {
    this.afterEach(async () => {
      await this.subject.close?.();
    });
    this.deliversToTheSubscribersOfTheType();
    this.stopsDeliveringOnceUnsubscribed();
    this.handsTheEnvelopeOverUntouched();
    this.survivesAFailingHandler();
  }

  private deliversToTheSubscribersOfTheType(): void {
    this.it('delivers an event to the subscribers of its type only', async () => {
      const happened = this.collect(HAPPENED);
      const ignored = this.collect(IGNORED);

      this.expect(await this.publish([busEvent('evt-1')])).toBe(undefined);

      this.expect(happened.ids()).toEqual(['evt-1']);
      this.expect(ignored.ids()).toEqual([]);
    });

    this.it('delivers to every subscriber of the type', async () => {
      const first = this.collect(HAPPENED);
      const second = this.collect(HAPPENED);

      await this.publish([busEvent('evt-1')]);

      this.expect(first.ids()).toEqual(['evt-1']);
      this.expect(second.ids()).toEqual(['evt-1']);
    });

    this.it('delivers every event of a batch', async () => {
      const happened = this.collect(HAPPENED);
      const ignored = this.collect(IGNORED);

      await this.publish([busEvent('evt-1'), busEvent('evt-2', IGNORED), busEvent('evt-3')]);

      this.expect(happened.ids()).toEqual(['evt-1', 'evt-3']);
      this.expect(ignored.ids()).toEqual(['evt-2']);
    });

    this.it('accepts an event nobody subscribed to', async () => {
      this.expect(await this.publish([busEvent('evt-1')])).toBe(undefined);
    });
  }

  private stopsDeliveringOnceUnsubscribed(): void {
    this.it('stops delivering to a handler once it is unsubscribed', async () => {
      const kept = this.collect(HAPPENED);
      const removed: string[] = [];
      const subscription = this.subject.bus.subscribe(HAPPENED, async (received) => {
        removed.push(received.id);
      });

      await this.publish([busEvent('evt-1')]);
      subscription.unsubscribe();
      const before = removed.length;
      await this.publish([busEvent('evt-2')]);

      this.expect(kept.ids()).toEqual(['evt-1', 'evt-2']);
      this.expect(removed.includes('evt-2')).toBe(false);
      this.expect(before > 0).toBe(true);
    });
  }

  private handsTheEnvelopeOverUntouched(): void {
    this.it('hands the envelope over exactly as published, trace and correlation included', async () => {
      const happened = this.collect(HAPPENED);
      const published = fullEnvelope(busEvent('evt-1'));

      await this.publish([published]);

      this.expect(happened.events[0]).toEqual(published);
    });

    this.it('does not invent a trace or a correlation when none was published', async () => {
      const happened = this.collect(HAPPENED);

      await this.publish([busEvent('evt-1')]);

      this.expect(happened.events[0]).toEqual(busEvent('evt-1'));
      this.expect(happened.events[0]?.traceparent).toBe(undefined);
      this.expect(happened.events[0]?.correlationId).toBe(undefined);
    });
  }

  private survivesAFailingHandler(): void {
    this.it('surfaces the failure of a handler without starving the other subscribers', async () => {
      let attempts = 0;
      this.subject.bus.subscribe(HAPPENED, async () => {
        attempts += 1;
        if (attempts === 1) {
          throw new Error('handler failed');
        }
      });
      const healthy = this.collect(HAPPENED);

      const failure = await this.publish([busEvent('evt-1')]);

      // Either the publication is rejected (in-process) or the event comes back (broker).
      this.expect(failure !== undefined || attempts > 1).toBe(true);
      this.expect(healthy.ids()).toEqual(['evt-1']);
    });
  }

  /** Subscribes and returns the distinct ids received, which is what at-least-once allows to assert. */
  private collect(type: string): { ids(): string[]; events: IntegrationEvent[] } {
    const events: IntegrationEvent[] = [];
    this.subject.bus.subscribe(type, async (received) => {
      events.push(received);
    });
    return { events, ids: () => [...new Set(events.map((received) => received.id))].sort() };
  }

  private async publish(events: readonly IntegrationEvent[]): Promise<unknown> {
    const failure = await failureOf(() => this.subject.bus.publish(events));
    await this.subject.settle?.();
    return failure;
  }
}

function busEvent(id: string, type = HAPPENED): IntegrationEvent {
  return {
    id,
    type,
    version: 1,
    occurredAt: '2026-03-01T10:00:00.000Z',
    payload: { thingId: `thing-${id}` },
  };
}

/** An envelope using everything a provider has to carry: nesting, null, offset, trace. */
function fullEnvelope(event: IntegrationEvent): IntegrationEvent {
  return {
    ...event,
    version: 3,
    occurredAt: '2026-03-01T11:30:00.123+01:00',
    payload: { thingId: 'thing-1', lines: [{ sku: 'sku-1', quantity: 2 }], note: null },
    traceparent: '00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01',
    correlationId: 'corr-7f3a',
  };
}

/**
 * The outbox store port of `@ddd-ts-kit/events`, restated structurally so that this package
 * does not depend on it. Any `OutboxStore` fits.
 */
export interface OutboxStoreUnderContract {
  append(events: readonly IntegrationEvent[]): Promise<void>;
  claimBatch(
    limit: number,
    now: Date,
  ): Promise<
    {
      readonly event: IntegrationEvent;
      readonly status: string;
      readonly attempts: number;
      readonly lastErrorCode?: string;
    }[]
  >;
  markPublished(ids: readonly string[], at: Date): Promise<void>;
  markFailed(id: string, error: { readonly code: string }, nextAttemptAt: Date | null): Promise<void>;
  retryDead(ids: readonly string[], now: Date): Promise<number>;
  purgePublished(before: Date): Promise<number>;
  stats(): Promise<{ readonly pending: number; readonly failed: number; readonly dead: number }>;
}

export interface OutboxStoreContractOptions {
  readonly name: string;
  /** A fresh, empty store; called before each test. */
  createStore(): Awaitable<OutboxStoreUnderContract>;
  /** The lease the created store is configured with: how long a claim hides a record. */
  readonly leaseMs: number;
}

export function outboxStoreContract(
  runner: ContractRunner,
  options: OutboxStoreContractOptions,
): void {
  new OutboxStoreSuite(runner, options).describe(`${options.name} (outbox store contract)`);
}

const NOW = new Date('2026-03-01T10:00:00.000Z');

class OutboxStoreSuite extends ContractSuite<OutboxStoreUnderContract> {
  readonly #leaseMs: number;

  constructor(runner: ContractRunner, options: OutboxStoreContractOptions) {
    super(runner, () => options.createStore());
    this.#leaseMs = options.leaseMs;
  }

  protected tests(): void {
    this.handsOutWhatWasAppended();
    this.returnsTheEventAsAppended();
    this.leasesWhatItHandsOut();
    this.followsTheOutcomeOfAnAttempt();
    this.revivesDeadRecords();
    this.purgesAndRefusesDuplicates();
  }

  private handsOutWhatWasAppended(): void {
    this.it('starts empty', async () => {
      this.expect(await this.subject.stats()).toEqual({ pending: 0, failed: 0, dead: 0 });
      this.expect(await this.subject.claimBatch(10, NOW)).toEqual([]);
    });

    this.it('hands out the appended events oldest first and counts the attempt', async () => {
      await this.subject.append([outboxEvent('evt-1'), outboxEvent('evt-2')]);
      await this.subject.append([outboxEvent('evt-3')]);
      this.expect(await this.subject.stats()).toEqual({ pending: 3, failed: 0, dead: 0 });

      const claimed = await this.subject.claimBatch(10, NOW);

      this.expect(claimed.map((record) => record.event.id)).toEqual(['evt-1', 'evt-2', 'evt-3']);
      this.expect(claimed.map((record) => record.attempts)).toEqual([1, 1, 1]);
      this.expect(claimed.map((record) => record.status)).toEqual(['pending', 'pending', 'pending']);
    });
  }

  private returnsTheEventAsAppended(): void {
    this.it('returns the event exactly as appended, trace and correlation included', async () => {
      const appended = fullEnvelope(outboxEvent('evt-1'));
      await this.subject.append([appended, outboxEvent('evt-2')]);

      const claimed = await this.subject.claimBatch(10, NOW);

      this.expect(claimed[0]?.event).toEqual(appended);
      this.expect(claimed[1]?.event).toEqual(outboxEvent('evt-2'));
      this.expect(claimed[1]?.event.traceparent).toBe(undefined);
      this.expect(claimed[1]?.event.correlationId).toBe(undefined);
    });
  }

  private leasesWhatItHandsOut(): void {
    this.it('honours the limit and leaves the rest to the next claim', async () => {
      await this.subject.append([outboxEvent('evt-1'), outboxEvent('evt-2'), outboxEvent('evt-3')]);

      this.expect(await this.claimedIds(2, NOW)).toEqual(['evt-1', 'evt-2']);
      this.expect(await this.claimedIds(2, NOW)).toEqual(['evt-3']);
    });

    this.it('hides a claimed record until its lease expires, then hands it out again', async () => {
      await this.subject.append([outboxEvent('evt-1')]);
      await this.subject.claimBatch(10, NOW);

      this.expect(await this.claimedIds(10, NOW)).toEqual([]);
      this.expect(await this.claimedIds(10, later(this.#leaseMs - 1))).toEqual([]);

      const again = await this.subject.claimBatch(10, later(this.#leaseMs));
      this.expect(again.map((record) => record.event.id)).toEqual(['evt-1']);
      this.expect(again[0]?.attempts).toBe(2);
    });

    this.it('never hands the same record to two concurrent claims', async () => {
      await this.subject.append(['1', '2', '3', '4', '5', '6'].map((n) => outboxEvent(`evt-${n}`)));

      const batches = await Promise.all([this.claimedIds(4, NOW), this.claimedIds(4, NOW)]);

      const ids = batches.flat();
      this.expect(ids.length).toBe(6);
      this.expect(new Set(ids).size).toBe(6);
    });
  }

  private followsTheOutcomeOfAnAttempt(): void {
    this.it('never hands out a published record again', async () => {
      await this.subject.append([outboxEvent('evt-1'), outboxEvent('evt-2')]);
      await this.subject.claimBatch(10, NOW);

      await this.subject.markPublished(['evt-1'], NOW);

      this.expect(await this.subject.stats()).toEqual({ pending: 1, failed: 0, dead: 0 });
      this.expect(await this.claimedIds(10, later(this.#leaseMs * 10))).toEqual(['evt-2']);
    });

    this.it('retries a failed record at its next attempt, not before', async () => {
      await this.subject.append([outboxEvent('evt-1')]);
      await this.subject.claimBatch(10, NOW);

      await this.subject.markFailed('evt-1', { code: 'BROKER_DOWN' }, later(5_000));

      this.expect(await this.subject.stats()).toEqual({ pending: 1, failed: 1, dead: 0 });
      this.expect(await this.claimedIds(10, later(4_999))).toEqual([]);
      const retried = await this.subject.claimBatch(10, later(5_000));
      this.expect(retried.map((record) => record.event.id)).toEqual(['evt-1']);
      this.expect(retried[0]?.attempts).toBe(2);
      this.expect(retried[0]?.lastErrorCode).toBe('BROKER_DOWN');
    });
  }

  private revivesDeadRecords(): void {
    this.it('sets a dead record aside for good', async () => {
      await this.subject.append([outboxEvent('evt-1'), outboxEvent('evt-2')]);
      await this.subject.claimBatch(10, NOW);

      await this.subject.markFailed('evt-1', { code: 'BROKER_DOWN' }, null);

      this.expect(await this.subject.stats()).toEqual({ pending: 1, failed: 0, dead: 1 });
      this.expect(await this.claimedIds(10, later(this.#leaseMs * 10))).toEqual(['evt-2']);
    });

    this.it('puts dead records back in the queue with a fresh attempt budget', async () => {
      await this.subject.append([outboxEvent('evt-1'), outboxEvent('evt-2')]);
      await this.subject.claimBatch(10, NOW);
      await this.subject.markFailed('evt-1', { code: 'BROKER_DOWN' }, null);
      await this.subject.markPublished(['evt-2'], NOW);

      const revivedCount = await this.subject.retryDead(['evt-1', 'evt-2', 'unknown'], later(1_000));
      this.expect(revivedCount).toBe(1);

      this.expect(await this.subject.stats()).toEqual({ pending: 1, failed: 1, dead: 0 });
      this.expect(await this.claimedIds(10, later(999))).toEqual([]);
      const revived = await this.subject.claimBatch(10, later(1_000));
      this.expect(revived.map((record) => record.event.id)).toEqual(['evt-1']);
      this.expect(revived[0]?.attempts).toBe(1);
    });
  }

  private purgesAndRefusesDuplicates(): void {
    this.it('purges only what was published before the given instant', async () => {
      await this.subject.append([outboxEvent('evt-1'), outboxEvent('evt-2'), outboxEvent('evt-3')]);
      await this.subject.claimBatch(10, NOW);
      await this.subject.markPublished(['evt-1'], NOW);
      await this.subject.markPublished(['evt-2'], later(1_000));

      this.expect(await this.subject.purgePublished(NOW)).toBe(0);
      this.expect(await this.subject.purgePublished(later(1_000))).toBe(1);

      this.expect(await this.subject.stats()).toEqual({ pending: 1, failed: 0, dead: 0 });
      this.expect(await this.subject.purgePublished(later(2_000))).toBe(1);
    });

    this.it('refuses an event id it already holds, and nothing of that batch gets in', async () => {
      await this.subject.append([outboxEvent('evt-1')]);

      const batch = [outboxEvent('evt-2'), outboxEvent('evt-1')];
      const failure = await failureOf(() => this.subject.append(batch));

      this.expect(failure !== undefined).toBe(true);
      this.expect(await this.subject.stats()).toEqual({ pending: 1, failed: 0, dead: 0 });
    });
  }

  private async claimedIds(limit: number, at: Date): Promise<string[]> {
    return (await this.subject.claimBatch(limit, at)).map((record) => record.event.id);
  }
}

function later(ms: number): Date {
  return new Date(NOW.getTime() + ms);
}

function outboxEvent(id: string): IntegrationEvent {
  return {
    id,
    type: 'contract.thing.happened',
    version: 1,
    occurredAt: '2026-03-01T09:59:59.000Z',
    payload: { thingId: `thing-${id}` },
  };
}

export interface ProcessedEventStoreContractOptions {
  readonly name: string;
  /** A fresh, empty store; called before each test. */
  createStore(): Awaitable<ProcessedEventStore>;
}

export function processedEventStoreContract(
  runner: ContractRunner,
  options: ProcessedEventStoreContractOptions,
): void {
  new ProcessedEventStoreSuite(runner, options).describe(
    `${options.name} (processed event store contract)`,
  );
}

class ProcessedEventStoreSuite extends ContractSuite<ProcessedEventStore> {
  constructor(runner: ContractRunner, options: ProcessedEventStoreContractOptions) {
    super(runner, () => options.createStore());
  }

  protected tests(): void {
    this.it('says yes the first time an event is seen by a consumer, no afterwards', async () => {
      this.expect(await this.subject.markProcessed('billing', 'evt-1')).toBe(true);
      this.expect(await this.subject.markProcessed('billing', 'evt-1')).toBe(false);
      this.expect(await this.subject.markProcessed('billing', 'evt-1')).toBe(false);
    });

    this.it('keeps consumers apart', async () => {
      await this.subject.markProcessed('billing', 'evt-1');

      this.expect(await this.subject.markProcessed('shipping', 'evt-1')).toBe(true);
    });

    this.it('keeps events apart', async () => {
      await this.subject.markProcessed('billing', 'evt-1');

      this.expect(await this.subject.markProcessed('billing', 'evt-2')).toBe(true);
    });

    this.it('does not confuse a separator inside a consumer name or an event id', async () => {
      await this.subject.markProcessed('billing:evt', '1');

      this.expect(await this.subject.markProcessed('billing', 'evt:1')).toBe(true);
    });

    this.it('says yes to exactly one of several concurrent deliveries', async () => {
      const answers = await Promise.all(
        Array.from({ length: 5 }, () => this.subject.markProcessed('billing', 'evt-1')),
      );

      this.expect(answers.filter((first) => first).length).toBe(1);
    });
  }
}
