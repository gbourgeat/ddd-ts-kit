import {
  ActorContext,
  Cache,
  Clock,
  CommandBus,
  DomainEventDispatcher,
  ErrorReporter,
  EventBus,
  EventSubscribers,
  ExecutionScope,
  IdGenerator,
  InMemoryProcessedEventStore,
  InMemoryUnitOfWork,
  IntegrationEventPublisher,
  IntegrationEventSubscriber,
  JobScheduler,
  Lock,
  Logger,
  Metrics,
  ProcessedEventStore,
  QueryBus,
  RateLimiter,
  UnitOfWork,
  dispatchingOnSave,
} from '@ddd-ts-kit/kernel';
import { describeToken } from '@ddd-ts-kit/kernel/declarations';
import type { Application } from '../application/application.js';
import { assemble } from '../application/assemble.js';
import { override, type Override } from '../application/override.js';
import { passEveryMessage } from '../authorization/pass-every-message.js';
import { UseCaseGuard } from '../authorization/use-case-guard.js';
import { WiringError } from '../errors/wiring-error.js';
import { KERNEL_PORTS } from '../kernel/kernel-ports.js';
import { collectWiring } from '../module/collect-wiring.js';
import { TokenSet } from '../token/token-set.js';
import type { KindAspect } from '../wiring/kind-aspect.js';
import { naturalKind } from '../wiring/natural-kind.js';
import type { Wiring } from '../wiring/wiring.js';
import { createTestKernel } from './create-test-kernel.js';
import type { TestApplicationOptions } from './test-application-options.js';
import { testApplicationOf } from './test-application-of.js';
import type { TestApplication } from './test-application.js';
import type { TestKernel } from './test-kernel.js';

/**
 * The modules on a deterministic, in-memory kernel (frozen clock, sequential identifiers,
 * in-process buses, idempotent consumers), with the fakes in place of the adapters. A repository,
 * the adapter of a module or the fake given for its port, dispatches domain events with its save
 * to `domainEvents`, as it does in the application, whether `kernelModule()` is listed or not. Consumers
 * declared with `builder.on(...)` receive events once `start()` was awaited. Every use case is
 * allowed unless a listed module binds the use case guard, as an authorization module does.
 */
export function createTestApplication(options: TestApplicationOptions): TestApplication {
  const declared = collectWiring(options.modules);
  const fakes = options.fakes ?? [];

  assertFakesAreUsed(declared, fakes);

  const kernel = createTestKernel(options, (target) => application.resolve(target));
  const dispatching = <T extends object>(repository: T): T => dispatchingOnSave(repository, () => kernel.domainEvents);
  const wiring = { ...declared, kindAspects: [...declared.kindAspects, repositoriesAround(dispatching)] };

  const application: Application = assemble(wiring, {
    modules: options.modules,
    overrides: [...kernelOverrides(kernel), ...guardOverride(wiring), ...fakes.map(savingFake(wiring, dispatching))],
    ...(options.authorization === undefined ? {} : { authorization: options.authorization }),
    jobs: { start: false, ...(options.jobs === undefined ? {} : { settings: options.jobs }) },
  });

  return testApplicationOf(application, kernel);
}

function assertFakesAreUsed(wiring: Wiring, fakes: readonly Override[]): void {
  const used = new TokenSet([
    ...KERNEL_PORTS,
    ...wiring.bindings.keys(),
    ...wiring.bindings.values().flatMap((binding) => binding.dependencies),
  ]);

  for (const [target] of fakes) {
    if (used.has(target)) {
      continue;
    }

    throw new WiringError(
      'UNKNOWN_FAKE',
      `A fake is given for "${describeToken(target)}", which no module binds and no class depends on. Check that it is the port the module uses; a port resolved only inside a factory is replaced with overrideForTests.`,
    );
  }
}

type Dispatching = <T extends object>(repository: T) => T;

/** Wrapping twice is a no-op, so a listed `kernelModule()` changes nothing. */
function repositoriesAround(dispatching: Dispatching): KindAspect {
  return { kinds: ['repository'], module: 'test', aspect: () => dispatching };
}

/** A fake stands for an adapter: the one of a repository port dispatches as the adapter would. */
function savingFake(wiring: Wiring, dispatching: Dispatching): (fake: Override) => Override {
  return ([target, value]) => {
    const kind = wiring.bindings.get(target)?.kind ?? naturalKind(target);
    const repository = kind === 'repository' && typeof value === 'object' && value !== null;

    return repository ? [target, dispatching(value)] : [target, value];
  };
}

function kernelOverrides(kernel: TestKernel): Override[] {
  return [
    override(Clock, kernel.clock),
    override(IdGenerator, kernel.ids),
    override(UnitOfWork, new InMemoryUnitOfWork()),
    override(CommandBus, kernel.commandBus),
    override(QueryBus, kernel.queryBus),
    override(EventBus, kernel.eventBus),
    override(IntegrationEventPublisher, kernel.eventBus),
    override(IntegrationEventSubscriber, kernel.eventBus),
    override(EventSubscribers, { forContext: () => kernel.eventBus }),
    override(ProcessedEventStore, new InMemoryProcessedEventStore()),
    override(DomainEventDispatcher, kernel.domainEvents),
    override(ActorContext, kernel.actorContext),
    override(ExecutionScope, kernel.executionScope),
    override(Logger, kernel.logger),
    override(Metrics, kernel.metrics),
    override(ErrorReporter, kernel.errors),
    override(Cache, kernel.cache),
    override(Lock, kernel.lock),
    override(RateLimiter, kernel.rateLimiter),
    override(JobScheduler, kernel.jobs.scheduler),
  ];
}

function guardOverride(wiring: Wiring): Override[] {
  return wiring.bindings.has(UseCaseGuard) ? [] : [override(UseCaseGuard, passEveryMessage)];
}
