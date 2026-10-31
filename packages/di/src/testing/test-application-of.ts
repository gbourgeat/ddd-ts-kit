import { executionContext, isSession, withActor, type FixedExecutionScope } from '@ddd-ts-kit/kernel';
import type { Application } from '../application/application';
import { delegatingApplications } from '../application/delegating-applications';
import type { TestApplication } from './test-application';
import type { TestKernel } from './test-kernel';

/**
 * The test application as an object of its own, in front of the application: it calls the
 * application and names each member of the test kernel. Nothing is written on the application,
 * so no member of the kernel can replace one of its fields, whatever their names.
 */
export function testApplicationOf<Native>(
  application: Application<Native>,
  kernel: TestKernel,
): TestApplication<Native> {
  const front: TestApplication<Native> = {
    ...membersOf(kernel),
    resolve: application.resolve,
    get: application.resolve,
    start: () => application.start(),
    stop: () => application.stop(),
    describe: () => application.describe(),
    container: application.container,
    as: runningAs(kernel.executionScope),
  };

  delegatingApplications.set(front, application);

  return front;
}

function membersOf(kernel: TestKernel): TestKernel {
  return {
    commandBus: kernel.commandBus,
    queryBus: kernel.queryBus,
    eventBus: kernel.eventBus,
    domainEvents: kernel.domainEvents,
    clock: kernel.clock,
    ids: kernel.ids,
    actorContext: kernel.actorContext,
    executionScope: kernel.executionScope,
    logger: kernel.logger,
    metrics: kernel.metrics,
    errors: kernel.errors,
    cache: kernel.cache,
    cacheInvalidation: kernel.cacheInvalidation,
    lock: kernel.lock,
    rateLimiter: kernel.rateLimiter,
    jobs: kernel.jobs,
    jobQueue: kernel.jobQueue,
    backgroundJobs: kernel.backgroundJobs,
    processes: kernel.processes,
  };
}

function runningAs(scope: FixedExecutionScope): TestApplication['as'] {
  return (who, work) => {
    const actor = isSession(who) ? who.actor : who;
    const seenAsActor = withActor(scope.require(), actor);
    const context = isSession(who) ? executionContext({ ...seenAsActor, session: who }) : seenAsActor;

    return scope.run(context, () => work(actor));
  };
}
