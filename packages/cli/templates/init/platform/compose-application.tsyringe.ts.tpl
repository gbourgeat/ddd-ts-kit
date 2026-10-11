import { installAspectRuntime } from '@ddd-ts-kit/aspects';
{{#if http.any}}
import { Authenticator } from '@ddd-ts-kit/auth';
{{/if}}
import {
  createApplication,
  kernelModule,
  type Application as Container,
  type ContextModule,
  type JobsOptions,
} from '@ddd-ts-kit/di';
{{#if events.outbox}}
import { OutboxPublisher } from '@ddd-ts-kit/events';
{{/if}}
{{#if http.any}}
import { ErrorMapper, defineRoutes, type Route } from '@ddd-ts-kit/http';
{{/if}}
import {
  Cache,
  Clock,
{{#if http.any}}
  CommandBus,
{{/if}}
{{#if errors.sentry}}
{{#if http.any}}
  ErrorReporter,
{{/if}}
{{/if}}
  EventBus,
{{#if http.any}}
  ExecutionScope,
{{/if}}
{{#unless broker.external}}
  IntegrationEventSubscriber,
{{/unless}}
  Logger,
  Metrics,
{{#if http.any}}
  QueryBus,
{{/if}}
{{#if cache.rateLimit}}
  RateLimiter,
{{/if}}
  scopedPublisher,
  type IntegrationEventPublisher,
{{#if broker.external}}
  type IntegrationEventSubscriber,
{{/if}}
} from '@ddd-ts-kit/kernel';
import { tracedPublisher } from '@ddd-ts-kit/tracing';
{{#if audit.on}}
import { auditModule } from '{{alias.platform}}/audit/audit.module.js';
{{/if}}
{{#if audit.route}}
import { searchAuditEntriesRoute } from '{{alias.platform}}/audit/search-audit-entries.route.js';
{{/if}}
import { authorization } from '{{alias.platform}}/auth/authorization.js';
{{#if http.any}}
import { httpBoundary, type HttpBoundary } from '{{alias.platform}}/auth/http-boundary.js';
{{/if}}
{{#if authz.rebac}}
import { relateSystemActors } from '{{alias.platform}}/auth/relate-system-actors.js';
{{/if}}
import { createCommandBus } from '{{alias.platform}}/buses/create-command-bus.js';
import { createQueryBus } from '{{alias.platform}}/buses/create-query-bus.js';
import type { Persistence } from '{{alias.platform}}/database/persistence.js';
import { layFoundations, type Foundations } from '{{alias.platform}}/lay-foundations.js';
import { platformModule, type PlatformOptions } from '{{alias.platform}}/platform.module.js';
// ddd-ts-kit:imports
// /ddd-ts-kit:imports

export interface ApplicationOptions extends PlatformOptions {
  /** Whether this process runs the scheduled jobs, and their settings; left out (the tools, the tests), no job runs by time. */
  readonly jobs?: JobsOptions;
}

export interface Application {
{{#if http.any}}
  readonly routes: readonly Route[];
  /** Authenticates every request and runs it inside the execution scope. */
  readonly boundary: HttpBoundary;
{{/if}}
{{#unless http.any}}
  readonly routes: readonly never[];
{{/unless}}
  /** The provider integration events are delivered to. */
  readonly eventBus: IntegrationEventPublisher;
  /** Where another context, or a test, listens to what this application publishes. */
  readonly eventSubscriber: IntegrationEventSubscriber;
  readonly logger: Logger;
{{#if cache.rateLimit}}
  /** What the HTTP server asks before anything else: on the Redis protocol server, or in the memory of the process without one. */
  readonly rateLimiter: RateLimiter;
{{/if}}
{{#if cache.redis}}

  /** Whether what the application depends on answers: the readiness probe of the HTTP server. */
  ready(): Promise<boolean>;

{{/if}}
  readonly container: Container;

  start(): Promise<void>;

  stop(): Promise<void>;
}

/** The contexts an application hosts: all of them here, one alone in `apps/<context>/main.ts`. */
export interface ContextSelection {
  readonly modules: readonly ContextModule[];
{{#if http.any}}
  /** The routes of each context, given the two buses they call. */
  readonly routes: readonly ((commands: CommandBus, queries: QueryBus) => readonly Route[])[];
{{/if}}
}

const everyContext: ContextSelection = {
  modules: [
    // ddd-ts-kit:contexts
    // /ddd-ts-kit:contexts
  ],
{{#if http.any}}
  routes: [
    // ddd-ts-kit:routes
    // /ddd-ts-kit:routes
  ],
{{/if}}
};

/** Wires the bounded contexts on the kernel and the platform. Also used to generate the contracts and by the end-to-end tests. */
export function composeApplication(
  persistence: Persistence,
  options: ApplicationOptions,
  contexts: ContextSelection = everyContext,
): Application {
  const foundations = layFoundations(persistence, options);
{{#if audit.on}}
  const guard = authorization(foundations.audit.decisions{{#if http.any}}, options.authenticator{{/if}});
{{/if}}
{{#unless audit.on}}
  const guard = authorization(foundations.decisions{{#if http.any}}, options.authenticator{{/if}});
{{/unless}}

  const container = createApplication({
    modules: [
      kernel(foundations, persistence, options),
      platformModule(persistence, options),
      guard,
{{#if audit.on}}
      auditModule(foundations.audit),
{{/if}}
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
{{#if events.outbox}}
    // Use cases publish to the outbox, in the transaction of their command; the relay of `main.ts` delivers to the provider.
    eventPublisher: scopedPublisher(new OutboxPublisher(persistence.outbox), scope),
{{/if}}
{{#unless events.outbox}}
    eventPublisher: scopedPublisher(bus, scope),
{{/unless}}
    eventSubscriber: bus,
{{#if errors.sentry}}
    // The buses and the jobs report through it, and `container.stop()` flushes it; left out (the tools, the tests), nothing is reported.
    ...(options.errors === undefined ? {} : { errorReporter: options.errors }),
{{/if}}
{{#if cache.relaySignal}}
    commandBus: (resolve) => createCommandBus(resolve, foundations, options),
{{/if}}
{{#unless cache.relaySignal}}
    commandBus: (resolve) => createCommandBus(resolve, foundations),
{{/unless}}
    queryBus: (resolve) => createQueryBus(resolve, foundations),
  });
}

function running(container: Container, options: ApplicationOptions, contexts: ContextSelection): Application {
  const logger = container.resolve(Logger);

  return {
{{#if http.any}}
    routes: routesOf(container, contexts),
    boundary: httpBoundary({
      authenticator: container.resolve(Authenticator),
      executionScope: container.resolve(ExecutionScope),
      errorMapper: container.resolve(ErrorMapper),
      clock: container.resolve(Clock),
      logger,
{{#if errors.sentry}}
      errors: container.resolve(ErrorReporter),
{{/if}}
    }),
{{/if}}
{{#unless http.any}}
    routes: [],
{{/unless}}
    // What the outbox relay delivers with: each publication continues the trace stored with its event.
    eventBus: tracedPublisher(container.resolve(EventBus)),
{{#if broker.external}}
    // Behind a broker a listener has queues of its own, under its own name.
    eventSubscriber: options.events.forConsumer('observer'),
{{/if}}
{{#unless broker.external}}
    eventSubscriber: container.resolve(IntegrationEventSubscriber),
{{/unless}}
    logger,
{{#if cache.rateLimit}}
    rateLimiter: container.resolve(RateLimiter),
{{/if}}
{{#if cache.redis}}
    ready: () => options.redis?.ready() ?? Promise.resolve(true),
{{/if}}
    container,
{{#if authz.rebac}}
    start: () =>
      relateSystemActors()
        .then(() => container.start())
        .then(() => options.events.start()),
{{/if}}
{{#unless authz.rebac}}
    start: () => container.start().then(() => options.events.start()),
{{/unless}}
    // The jobs, the consumers, the event provider (`onStop` of the platform module), then the error reporter and, last, the logger: whatever logs has closed before its final flush.
    stop: () => container.stop(),
  };
}
{{#if http.any}}

function routesOf(container: Container, contexts: ContextSelection): readonly Route[] {
  const commands = container.resolve(CommandBus);
  const queries = container.resolve(QueryBus);

  return defineRoutes(...contexts.routes.map((routes) => routes(commands, queries)){{#if audit.route}}, [searchAuditEntriesRoute(queries)]{{/if}});
}
{{/if}}
