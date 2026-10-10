import {
  ActorContext,
  Cache,
  Clock,
  CommandBus,
  DomainEventDispatcher,
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
  executionContext,
  isSession,
  withActor,
  type FixedExecutionScope,
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
import type { Wiring } from '../wiring/wiring.js';
import { createTestKernel } from './create-test-kernel.js';
import type { TestApplicationOptions } from './test-application-options.js';
import type { TestApplication } from './test-application.js';
import type { TestKernel } from './test-kernel.js';

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

function assertFakesAreUsed(wiring: Wiring, fakes: readonly Override[]): void {
  const used = new TokenSet([
    ...KERNEL_PORTS,
    ...wiring.bindings.keys(),
    ...wiring.bindings.values().flatMap((binding) => binding.dependencies),
  ]);

  for (const [target] of fakes) {
    if (used.has(target)) continue;

    throw new WiringError(
      'UNKNOWN_FAKE',
      `A fake is given for "${describeToken(target)}", which no module binds and no class depends on. Check that it is the port the module uses; a port resolved only inside a factory is replaced with overrideForTests.`,
    );
  }
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
    override(Cache, kernel.cache),
    override(Lock, kernel.lock),
    override(RateLimiter, kernel.rateLimiter),
    override(JobScheduler, kernel.jobs.scheduler),
  ];
}

function guardOverride(wiring: Wiring): Override[] {
  return wiring.bindings.has(UseCaseGuard) ? [] : [override(UseCaseGuard, passEveryMessage)];
}

function runningAs(scope: FixedExecutionScope): TestApplication['as'] {
  return (who, work) => {
    const actor = isSession(who) ? who.actor : who;
    const seenAsActor = withActor(scope.require(), actor);
    const context = isSession(who) ? executionContext({ ...seenAsActor, session: who }) : seenAsActor;

    return scope.run(context, () => work(actor));
  };
}
