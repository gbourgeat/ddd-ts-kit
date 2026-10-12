import { installAspectRuntime } from '@ddd-ts-kit/aspects';
import { Authenticator } from '@ddd-ts-kit/auth';
import { RelationTupleStore } from '@ddd-ts-kit/auth/rebac';
import {
  contextModule,
  createApplication,
  kernelModule,
  type Application as Container,
  type ContextModule,
  type JobsOptions,
} from '@ddd-ts-kit/di';
import { OutboxPublisher } from '@ddd-ts-kit/events';
import { ErrorMapper, defineRoutes, type Route } from '@ddd-ts-kit/http';
import {
  Cache,
  Clock,
  CommandBus,
  ErrorReporter,
  EventBus,
  ExecutionScope,
  Logger,
  Metrics,
  QueryBus,
  RateLimiter,
  scopedPublisher,
  type IntegrationEventPublisher,
  type IntegrationEventSubscriber,
} from '@ddd-ts-kit/kernel';
import { tracedPublisher } from '@ddd-ts-kit/tracing';
import { auditModule } from '@/platform/audit/audit.module';
import { searchAuditEntriesRoute } from '@/platform/audit/search-audit-entries.route';
import { authorization } from '@/platform/auth/authorization';
import { httpBoundary, type HttpBoundary } from '@/platform/auth/http-boundary';
import { relateSystemActors } from '@/platform/auth/relate-system-actors';
import { createCommandBus } from '@/platform/buses/create-command-bus';
import { createQueryBus } from '@/platform/buses/create-query-bus';
import type { Persistence } from '@/platform/database/persistence';
import { layFoundations, type Foundations } from '@/platform/lay-foundations';
import { platformModule, type PlatformOptions } from '@/platform/platform.module';
// ddd-ts-kit:imports
import * as identityDeclarations from '@/contexts/identity/identity.declarations';
import { identityRoutes } from '@/contexts/identity/presentation/http/identity.routes';
import * as schedulingDeclarations from '@/contexts/scheduling/scheduling.declarations';
import { schedulingRoutes } from '@/contexts/scheduling/presentation/http/scheduling.routes';
import * as notificationDeclarations from '@/contexts/notification/notification.declarations';
import { notificationRoutes } from '@/contexts/notification/presentation/http/notification.routes';
import * as analyticsDeclarations from '@/contexts/analytics/analytics.declarations';
import { analyticsRoutes } from '@/contexts/analytics/presentation/http/analytics.routes';
// /ddd-ts-kit:imports

export interface ApplicationOptions extends PlatformOptions {
  /** Whether this process runs the scheduled jobs, and their settings; left out (the tools, the tests), no job runs by time. */
  readonly jobs?: JobsOptions;
}

export interface Application {
  readonly routes: readonly Route[];
  /** Authenticates every request and runs it inside the execution scope. */
  readonly boundary: HttpBoundary;
  /** The provider integration events are delivered to. */
  readonly eventBus: IntegrationEventPublisher;
  /** Where another context, or a test, listens to what this application publishes. */
  readonly eventSubscriber: IntegrationEventSubscriber;
  readonly logger: Logger;
  /** What the HTTP server asks before anything else: on the Redis protocol server, or in the memory of the process without one. */
  readonly rateLimiter: RateLimiter;

  /** Whether what the application depends on answers: the readiness probe of the HTTP server. */
  ready(): Promise<boolean>;

  readonly container: Container;

  start(): Promise<void>;

  stop(): Promise<void>;
}

/** The contexts an application hosts: all of them here, one alone in `apps/<context>/main.ts`. */
export interface ContextSelection {
  readonly modules: readonly ContextModule[];
  /** The routes of each context, given the two buses they call. */
  readonly routes: readonly ((commands: CommandBus, queries: QueryBus) => readonly Route[])[];
}

const everyContext: ContextSelection = {
  modules: [
    // ddd-ts-kit:contexts
    contextModule('identity', identityDeclarations),
    contextModule('scheduling', schedulingDeclarations),
    contextModule('notification', notificationDeclarations),
    contextModule('analytics', analyticsDeclarations),
    // /ddd-ts-kit:contexts
  ],
  routes: [
    // ddd-ts-kit:routes
    identityRoutes,
    schedulingRoutes,
    notificationRoutes,
    analyticsRoutes,
    // /ddd-ts-kit:routes
  ],
};

/** Wires the bounded contexts on the kernel and the platform. Also used to generate the contracts and by the end-to-end tests. */
export function composeApplication(
  persistence: Persistence,
  options: ApplicationOptions,
  contexts: ContextSelection = everyContext,
): Application {
  const foundations = layFoundations(persistence, options);
  const guard = authorization(foundations.audit.decisions, options.authenticator);

  const container = createApplication({
    modules: [
      kernel(foundations, persistence, options),
      platformModule(persistence, options),
      guard,
      auditModule(foundations.audit),
      ...contexts.modules,
    ],
    authorization: 'required',
    jobs: options.jobs ?? { start: false },
  });

  installAspectRuntime({
    logger: container.resolve(Logger),
    metrics: container.resolve(Metrics),
    cache: container.resolve(Cache),
    clock: container.resolve(Clock),
  });

  return running(container, options, contexts);
}

/**
 * The ports of the kernel on what this platform chose: one execution scope, one clock and one
 * generator for the buses, the logger and every adapter. The instrumentation observes the
 * application from outside (one span per use case, repository call, domain event, publication,
 * consumer and job), so what it must see is given here: a port rebound by a later module is
 * not wrapped.
 */
function kernel(foundations: Foundations, persistence: Persistence, options: ApplicationOptions): ContextModule {
  const { scope, clock, ids, logger, metrics } = foundations;
  const { bus } = options.events;

  return kernelModule({
    instrumentation: foundations.traced,
    clock,
    ids,
    executionScope: scope,
    logger,
    metrics,
    eventBus: bus,
    // Use cases publish to the outbox, in the transaction of their command; the relay of `main.ts` delivers to the provider.
    eventPublisher: scopedPublisher(new OutboxPublisher(persistence.outbox), scope),
    eventSubscriber: bus,
    // The buses and the jobs report through it, and `container.stop()` flushes it; left out (the tools, the tests), nothing is reported.
    ...(options.errors === undefined ? {} : { errorReporter: options.errors }),
    commandBus: (resolve) => createCommandBus(resolve, foundations, options),
    queryBus: (resolve) => createQueryBus(resolve, foundations),
  });
}

function running(container: Container, options: ApplicationOptions, contexts: ContextSelection): Application {
  const logger = container.resolve(Logger);

  return {
    routes: routesOf(container, contexts),
    boundary: httpBoundary({
      authenticator: container.resolve(Authenticator),
      executionScope: container.resolve(ExecutionScope),
      errorMapper: container.resolve(ErrorMapper),
      clock: container.resolve(Clock),
      logger,
      errors: container.resolve(ErrorReporter),
    }),
    // What the outbox relay delivers with: each publication continues the trace stored with its event.
    eventBus: tracedPublisher(container.resolve(EventBus)),
    // Behind a broker a listener has queues of its own, under its own name.
    eventSubscriber: options.events.forConsumer('observer'),
    logger,
    rateLimiter: container.resolve(RateLimiter),
    ready: () => options.redis?.ready() ?? Promise.resolve(true),
    container,
    start: () =>
      relateSystemActors(container.resolve(RelationTupleStore))
        .then(() => container.start())
        .then(() => options.events.start()),
    // The jobs, the consumers, the event provider (`onStop` of the platform module), then the error reporter and, last, the logger: whatever logs has closed before its final flush.
    stop: () => container.stop(),
  };
}

function routesOf(container: Container, contexts: ContextSelection): readonly Route[] {
  const commands = container.resolve(CommandBus);
  const queries = container.resolve(QueryBus);

  return defineRoutes(...contexts.routes.map((routes) => routes(commands, queries)), [
    searchAuditEntriesRoute(queries),
  ]);
}
