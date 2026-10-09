import {
  FixedActorContext,
  FixedClock,
  FixedExecutionScope,
  InMemoryCache,
  InMemoryEventBus,
  InMemoryLogger,
  InMemoryMetrics,
  InMemoryProcessedEventStore,
  InMemoryUnitOfWork,
  SequentialIdGenerator,
  executionContext,
  type Actor,
  type InMemoryCommandBus,
  type InMemoryQueryBus,
} from '@ddd-ts-kit/kernel';
import { ACTOR_CONTEXT, USE_CASE_GUARD, passEveryMessage, type AuthorizationMode } from './authorization.js';
import { assemble, override, type Application, type Override } from './application.js';
import { WiringError } from './errors.js';
import { guardedQueryBus, transactionalCommandBus } from './kernel-module.js';
import {
  CACHE,
  CLOCK,
  COMMAND_BUS,
  EVENT_BUS,
  EVENT_PUBLISHER,
  EVENT_SUBSCRIBER,
  EXECUTION_SCOPE,
  ID_GENERATOR,
  KERNEL_TOKENS,
  LOGGER,
  METRICS,
  PROCESSED_EVENTS,
  QUERY_BUS,
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
  /** See `ApplicationOptions.authorization`. */
  readonly authorization?: AuthorizationMode;
}

export interface TestKernel {
  readonly commandBus: InMemoryCommandBus;
  readonly queryBus: InMemoryQueryBus;
  /** Publisher and subscriber at once; `published` lists what the use cases announced. */
  readonly eventBus: InMemoryEventBus;
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
}

export interface TestApplication extends Application, TestKernel {
  /** `resolve` under the name a test reads better with: `app.get(ORDER_REPOSITORY)`. */
  readonly get: Resolve;
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
  });
  return Object.assign(application, kernel, { get: application.resolve });
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
  const actor = options.actor ?? DEFAULT_ACTOR;
  const actorContext = new FixedActorContext(actor);
  const context = executionContext({ correlationId: 'test-correlation', actor, origin: 'test' });
  return {
    commandBus: transactionalCommandBus(resolve),
    queryBus: guardedQueryBus(resolve),
    eventBus: new InMemoryEventBus(),
    clock,
    ids: new SequentialIdGenerator(options.idPrefix),
    actorContext,
    executionScope: new FixedExecutionScope(context, actorContext),
    logger: new InMemoryLogger(),
    metrics: new InMemoryMetrics(),
    cache: new InMemoryCache(clock),
  };
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
    override(ACTOR_CONTEXT, kernel.actorContext),
    override(EXECUTION_SCOPE, kernel.executionScope),
    override(LOGGER, kernel.logger),
    override(METRICS, kernel.metrics),
    override(CACHE, kernel.cache),
  ];
}
