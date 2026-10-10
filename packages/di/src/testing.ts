import {
  FixedActorContext,
  FixedClock,
  FixedExecutionScope,
  InMemoryCache,
  InMemoryDomainEventDispatcher,
  InMemoryEventBus,
  InMemoryLock,
  InMemoryLogger,
  InMemoryMetrics,
  InMemoryProcessedEventStore,
  InMemoryRateLimiter,
  InMemoryUnitOfWork,
  SequentialIdGenerator,
  executionContext,
  isSession,
  withActor,
  type Actor,
  type ExecutionContext,
  type InMemoryCommandBus,
  type InMemoryQueryBus,
  type JobRun,
  type Session,
} from '@ddd-ts-kit/kernel';
import { ManualJobScheduler } from '@ddd-ts-kit/scheduling/testing';
import { USE_CASE_GUARD, passEveryMessage, type AuthorizationMode } from './authorization.js';
import { assemble, override, type Application, type Override } from './application.js';
import { WiringError } from './errors.js';
import type { JobsOptions } from './jobs.js';
import { guardedQueryBus, transactionalCommandBus } from './kernel-module.js';
import {
  ACTOR_CONTEXT,
  CACHE,
  CLOCK,
  COMMAND_BUS,
  DOMAIN_EVENTS,
  EVENT_BUS,
  EVENT_PUBLISHER,
  EVENT_SUBSCRIBER,
  EXECUTION_SCOPE,
  ID_GENERATOR,
  JOB_SCHEDULER,
  KERNEL_TOKENS,
  LOCK,
  LOGGER,
  METRICS,
  PROCESSED_EVENTS,
  QUERY_BUS,
  RATE_LIMITER,
  UNIT_OF_WORK,
} from './kernel-tokens.js';
import { collectWiring, type ContextModule, type Resolve, type Wiring } from './module.js';
import { describeToken, type Token } from './token.js';

export interface TestApplicationOptions {
  /** The context modules under test. `kernelModule()` may be listed or left out. */
  readonly modules: readonly ContextModule[];
  /** Each must stand for a token that a module binds or that a class depends on. */
  readonly fakes?: readonly Override[];
  /** The instant the clock is frozen at. Default 2026-01-01T00:00:00.000Z. */
  readonly now?: Date;
  /** Prefix of the generated identifiers. Default `id`, giving `id-1`, `id-2`... */
  readonly idPrefix?: string;
  /**
   * Who infrastructure sees as the current actor. Default: the user `test-user`, without role.
   * Use cases never read it: a test passes the actor in the command or query.
   */
  readonly actor?: Actor;
  /**
   * The session infrastructure sees in the execution context. Its actor is the current actor:
   * give `session` or `actor`, the session wins.
   */
  readonly session?: Session;
  /**
   * The whole execution context infrastructure sees, for a spec about a tenant, a correlation,
   * a deadline or an origin. Its actor and session win over `actor` and `session`.
   */
  readonly executionContext?: ExecutionContext;
  /** See `ApplicationOptions.authorization`. */
  readonly authorization?: AuthorizationMode;
  /** See `JobsOptions.settings`: what configuration changes of a declared job, by job name. */
  readonly jobs?: NonNullable<JobsOptions['settings']>;
}

export interface TestKernel {
  readonly commandBus: InMemoryCommandBus;
  readonly queryBus: InMemoryQueryBus;
  /** Publisher and subscriber at once; `published` lists what the use cases announced. */
  readonly eventBus: InMemoryEventBus;
  /** Where a spec dispatches a domain event to see the declared handlers of the context react. */
  readonly domainEvents: InMemoryDomainEventDispatcher;
  readonly clock: FixedClock;
  readonly ids: SequentialIdGenerator;
  /** Change the current actor with `actorContext.actAs(actor)` or `actorContext.run(actor, work)`. */
  readonly actorContext: FixedActorContext;
  /**
   * The execution context infrastructure sees: correlation `test-correlation`, origin `test`.
   * It follows `actorContext`; replace it with `executionScope.enter(context)`.
   */
  readonly executionScope: FixedExecutionScope;
  /** `logger.entries` lists what was logged. */
  readonly logger: InMemoryLogger;
  /** `metrics.samples` lists what was measured. */
  readonly metrics: InMemoryMetrics;
  /** Expires by `clock`. */
  readonly cache: InMemoryCache;
  /** Frees a key by `clock`; a wait for a held key really waits. */
  readonly lock: InMemoryLock;
  /** Counts by `clock`. */
  readonly rateLimiter: InMemoryRateLimiter;
  /** The declared jobs, which no time starts: a spec runs one, then asserts its fakes. */
  readonly jobs: TestJobs;
}

export interface TestJobs {
  /**
   * Runs a job now, as the scheduler would (execution scope of origin `schedule`, system actor
   * of the job), and answers what became of it. Unlike the port, it throws what the job threw:
   * a spec wants the failure, not its code.
   */
  runNow(name: string): Promise<JobRun>;
  /**
   * On `clock`, not started: for a spec about time itself, `await jobs.scheduler.start()` then
   * `await jobs.scheduler.advance(ms)`, and `jobs.scheduler.runs` lists what happened.
   */
  readonly scheduler: ManualJobScheduler;
}

export interface TestApplication extends Application, TestKernel {
  /** `resolve` under the name a test reads better with: `app.get(ORDER_REPOSITORY)`. */
  readonly get: Resolve;
  /**
   * Runs a block as someone else: infrastructure sees that actor (and that session, when one
   * is given) until the block is over, and the block receives the actor to put in its commands.
   * `await app.as(bob, (actor) => app.commandBus.execute(new VoidInvoice(actor, id)))`.
   */
  as<T>(who: Actor | Session, work: (actor: Actor) => T): T;
}

/** A type-checked fake for `createTestApplication({ fakes })`. */
export function fake<T>(target: Token<T>, value: T): Override {
  return override(target, value);
}

/**
 * The modules on a deterministic, in-memory kernel (frozen clock, sequential identifiers,
 * in-process buses, idempotent consumers), with the fakes in place of the adapters. Consumers
 * declared with `builder.on(...)` receive events once `start()` was awaited. Every use case is
 * allowed unless a listed module binds the use case guard, as an authorization module does.
 */
export function createTestApplication(options: TestApplicationOptions): TestApplication {
  const wiring = collectWiring(options.modules);
  const fakes = options.fakes ?? [];
  assertFakesAreUsed(wiring, fakes);
  const kernel = createTestKernel(options, (target) => application.resolve(target));
  const application: Application = assemble(wiring, {
    modules: options.modules,
    overrides: [...kernelOverrides(kernel), ...guardOverride(wiring), ...fakes],
    ...(options.authorization === undefined ? {} : { authorization: options.authorization }),
    jobs: { start: false, ...(options.jobs === undefined ? {} : { settings: options.jobs }) },
  });
  return Object.assign(application, kernel, { get: application.resolve, as: runningAs(kernel.executionScope) });
}

function runningAs(scope: FixedExecutionScope): TestApplication['as'] {
  return (who, work) => {
    const actor = isSession(who) ? who.actor : who;
    const seenAsActor = withActor(scope.require(), actor);
    const context = isSession(who) ? executionContext({ ...seenAsActor, session: who }) : seenAsActor;
    return scope.run(context, () => work(actor));
  };
}

function assertFakesAreUsed(wiring: Wiring, fakes: readonly Override[]): void {
  const used = new Set<Token<unknown>>([
    ...KERNEL_TOKENS,
    ...wiring.bindings.keys(),
    ...[...wiring.bindings.values()].flatMap((binding) => binding.dependencies),
  ]);
  for (const [target] of fakes) {
    if (used.has(target)) continue;
    throw new WiringError(
      'UNKNOWN_FAKE',
      `A fake is given for "${describeToken(target)}", which no module binds and no class depends on. Check that it is the token the module uses; a token resolved only inside a factory is replaced with overrideForTests.`,
    );
  }
}

function guardOverride(wiring: Wiring): Override[] {
  return wiring.bindings.has(USE_CASE_GUARD) ? [] : [override(USE_CASE_GUARD, passEveryMessage)];
}

const DEFAULT_NOW = new Date('2026-01-01T00:00:00.000Z');
const DEFAULT_ACTOR: Actor = { id: 'test-user', type: 'user', roles: [], attributes: {} };

function createTestKernel(options: TestApplicationOptions, resolve: Resolve): TestKernel {
  const clock = new FixedClock(options.now ?? DEFAULT_NOW);
  const context = options.executionContext ?? defaultExecutionContext(options);
  const actorContext = new FixedActorContext(context.actor);
  const executionScope = new FixedExecutionScope(context, actorContext);
  const observability = { logger: new InMemoryLogger(), metrics: new InMemoryMetrics(), lock: new InMemoryLock(clock) };
  return {
    commandBus: transactionalCommandBus(resolve),
    queryBus: guardedQueryBus(resolve),
    eventBus: new InMemoryEventBus(),
    domainEvents: new InMemoryDomainEventDispatcher(),
    clock,
    ids: new SequentialIdGenerator(options.idPrefix),
    actorContext,
    executionScope,
    ...observability,
    cache: new InMemoryCache(clock),
    rateLimiter: new InMemoryRateLimiter(clock),
    jobs: testJobs(new ManualJobScheduler({ clock, scope: executionScope, ids: new SequentialIdGenerator('job-run'), ...observability })),
  };
}

function testJobs(scheduler: ManualJobScheduler): TestJobs {
  return {
    scheduler,
    async runNow(name) {
      const run = await scheduler.runNow(name);
      if (run.outcome === 'failed') throw scheduler.failures.at(-1);
      return run;
    },
  };
}

function defaultExecutionContext({ session, actor }: TestApplicationOptions): ExecutionContext {
  return executionContext({
    correlationId: 'test-correlation',
    actor: session?.actor ?? actor ?? DEFAULT_ACTOR,
    origin: 'test',
    ...(session === undefined ? {} : { session }),
  });
}

function kernelOverrides(kernel: TestKernel): Override[] {
  return [
    override(CLOCK, kernel.clock),
    override(ID_GENERATOR, kernel.ids),
    override(UNIT_OF_WORK, new InMemoryUnitOfWork()),
    override(COMMAND_BUS, kernel.commandBus),
    override(QUERY_BUS, kernel.queryBus),
    override(EVENT_BUS, kernel.eventBus),
    override(EVENT_PUBLISHER, kernel.eventBus),
    override(EVENT_SUBSCRIBER, kernel.eventBus),
    override(PROCESSED_EVENTS, new InMemoryProcessedEventStore()),
    override(DOMAIN_EVENTS, kernel.domainEvents),
    override(ACTOR_CONTEXT, kernel.actorContext),
    override(EXECUTION_SCOPE, kernel.executionScope),
    override(LOGGER, kernel.logger),
    override(METRICS, kernel.metrics),
    override(CACHE, kernel.cache),
    override(LOCK, kernel.lock),
    override(RATE_LIMITER, kernel.rateLimiter),
    override(JOB_SCHEDULER, kernel.jobs.scheduler),
  ];
}
