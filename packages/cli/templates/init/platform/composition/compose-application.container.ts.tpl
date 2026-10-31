import { installAspectRuntime } from '@ddd-ts-kit/aspects';
{{#if http.any}}
{{#if presentation.any}}
import { Access, Authenticator } from '@ddd-ts-kit/auth';
{{/if}}
{{#unless presentation.any}}
import { Authenticator } from '@ddd-ts-kit/auth';
{{/unless}}
{{/if}}
import { kernelModule, type Application as Container, type ContextModule, type JobsOptions } from '@ddd-ts-kit/di';
import { createApplication } from '{{di.entry}}';
{{#if events.outbox}}
import { OutboxPublisher } from '@ddd-ts-kit/events';
{{/if}}
{{#if http.any}}
import { ErrorMapper, type Route } from '@ddd-ts-kit/http';
{{/if}}
import {
  Cache,
  Clock,
{{#if errors.sentry}}
{{#if http.any}}
  ErrorReporter,
{{/if}}
{{/if}}
  EventBus,
  ExecutionScope,
{{#if files.http}}
  FileStorage,
{{/if}}
{{#if files.any}}
  InMemoryFileStorage,
{{/if}}
{{#unless broker.external}}
  IntegrationEventSubscriber,
{{/unless}}
  JobScheduler,
  Logger,
  Metrics,
{{#if httpCache.perTenant}}
  PublishedCacheInvalidation,
{{/if}}
{{#if cache.rateLimit}}
  RateLimiter,
{{/if}}
  scopedPublisher,
{{#if files.any}}
{{#unless files.http}}
  type FileStorage,
{{/unless}}
{{/if}}
  type IntegrationEventPublisher,
{{#if broker.external}}
  type IntegrationEventSubscriber,
{{/if}}
} from '@ddd-ts-kit/kernel';
import { tracedPublisher } from '@ddd-ts-kit/tracing';
{{#if audit.on}}
import { auditModule } from '{{alias.platform}}/audit/audit.module{{alias.ext}}';
{{/if}}
import { authorization } from '{{alias.platform}}/auth/authorization/authorization{{alias.ext}}';
{{#if http.any}}
import { httpBoundary, type HttpBoundary } from '{{alias.platform}}/auth/authentication/http-boundary{{alias.ext}}';
{{/if}}
{{#if presentation.any}}
import { presentationOf } from '{{alias.platform}}/http/presentation-of{{alias.ext}}';
{{/if}}
{{#if presentation.forms}}
import { withForms } from '{{alias.platform}}/http/with-forms{{alias.ext}}';
{{/if}}
{{#if authz.rebac}}
import { relateSystemActors } from '{{alias.platform}}/auth/relationships/relate-system-actors{{alias.ext}}';
{{/if}}
import { createCommandBus } from '{{alias.platform}}/buses/create-command-bus{{alias.ext}}';
import { createQueryBus } from '{{alias.platform}}/buses/create-query-bus{{alias.ext}}';
import type { Persistence } from '{{alias.platform}}/database/persistence{{alias.ext}}';
{{#if eventSourcing.on}}
import { eventSourcingModule } from '{{alias.platform}}/event-sourcing/event-sourcing.module{{alias.ext}}';
{{/if}}
{{#if files.http}}
import { fileRoutes } from '{{alias.platform}}/files/file-routes{{alias.ext}}';
{{/if}}
{{#if files.any}}
import { filesModule } from '{{alias.platform}}/files/files.module{{alias.ext}}';
{{/if}}
{{#if housekeeping.any}}
import { DEFAULT_HOUSEKEEPING } from '{{alias.platform}}/jobs/housekeeping{{alias.ext}}';
import { housekeepingModule } from '{{alias.platform}}/jobs/housekeeping.module{{alias.ext}}';
{{/if}}
{{#if privacy.on}}
import { privacyModule } from '{{alias.platform}}/privacy/privacy.module{{alias.ext}}';
{{/if}}
import type { ContextSelection } from '{{alias.platform}}/composition/context-selection{{alias.ext}}';
{{#if http.any}}
import { routesOf } from '{{alias.platform}}/composition/routes-of{{alias.ext}}';
{{/if}}
import { layFoundations, type Foundations } from '{{alias.platform}}/composition/lay-foundations{{alias.ext}}';
{{#if tenancy.any}}
import { tenantDirectory } from '{{alias.platform}}/composition/tenant-directory{{alias.ext}}';
{{/if}}
import { platformModule, type PlatformOptions } from '{{alias.platform}}/composition/platform.module{{alias.ext}}';
// ddd-ts-kit:imports
// /ddd-ts-kit:imports

export interface ApplicationOptions extends PlatformOptions {
  /** Whether this process runs the scheduled jobs, and their settings; left out (the tools, the tests), no job runs by time. */
  readonly jobs?: JobsOptions;
  /** Whether the jobs of the platform itself are registered: a service passes `false`, they run in the whole application. Default `true`. */
  readonly platformJobs?: boolean;
{{#if tenancy.any}}
  /** The ids of the tenants that exist (`TENANTS`): a job declared `per-tenant` runs once for each. Left out (the tools, the tests), none, and such a job runs for nobody. */
  readonly tenants?: readonly string[];
{{/if}}
{{#if files.any}}
  /** Where the content of files lives: the storage of `main.ts`; left out (the tools, the tests), the memory of the process. */
  readonly files?: FileStorage;
{{/if}}
}

export interface Application {
{{#if http.any}}
  readonly routes: readonly Route[];
  /** Authenticates every request and runs it inside the execution scope. */
  readonly boundary: HttpBoundary;
{{/if}}
{{#if files.http}}
  /** The routes that answer the signed links of a storage the application serves itself; mounted before any body parser. */
  readonly fileRoutes: readonly Route[];
{{/if}}
{{#unless http.any}}
  readonly routes: readonly never[];
{{/unless}}
  /** The provider integration events are delivered to. */
  readonly eventBus: IntegrationEventPublisher;
  /** Where another context, or a test, listens to what this application publishes. */
  readonly eventSubscriber: IntegrationEventSubscriber;
  readonly logger: Logger;
  readonly metrics: Metrics;
  /** Runs a job at once, for a test: `jobs.runNow('<context>.<job>')`. */
  readonly jobs: JobScheduler;
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

export const everyContext: ContextSelection = {
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

/** The contexts run as services of their own (`generate service`): `main.ts` and the worker leave them out, routes included. */
const extractedModules: readonly string[] = [
  // ddd-ts-kit:extracted
  // /ddd-ts-kit:extracted
];
{{#if http.any}}

const extractedRoutes: NonNullable<ContextSelection['routes']> = [
  // ddd-ts-kit:extracted-routes
  // /ddd-ts-kit:extracted-routes
];
{{/if}}

/** What `main.ts` and the worker host; `everyContext` stays the full list for the tools, the contracts and the end-to-end tests. */
export const hostedContexts: ContextSelection = {
  modules: everyContext.modules.filter((module) => !extractedModules.includes(module.name)),
{{#if http.any}}
  routes: (everyContext.routes ?? []).filter((routes) => !extractedRoutes.includes(routes)),
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
{{#if eventSourcing.on}}
      eventSourcingModule(foundations.eventSourcing),
{{/if}}
      guard,
{{#if audit.sql}}
      auditModule(foundations.audit, { jobs: options.platformJobs !== false }),
{{/if}}
{{#if audit.memory}}
      auditModule(foundations.audit),
{{/if}}
{{#if files.any}}
      filesModule(options.files ?? new InMemoryFileStorage(), { jobs: options.platformJobs !== false }),
{{/if}}
{{#if privacy.on}}
      privacyModule({ jobs: options.platformJobs !== false }),
{{/if}}
{{#if housekeeping.any}}
      housekeepingModule(options.housekeeping ?? DEFAULT_HOUSEKEEPING, { jobs: options.platformJobs !== false }),
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
    scope: container.resolve(ExecutionScope),
  });

{{#if audit.route}}
  return running({ container, foundations, options, contexts });
{{/if}}
{{#unless audit.route}}
  return running({ container, options, contexts });
{{/unless}}
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
{{#if tenancy.any}}
    // The tenants a job declared `per-tenant` runs for, asked at each occurrence.
    tenants: tenantDirectory(persistence, options.tenants),
{{/if}}
{{#if events.outbox}}
    // Use cases publish to the outbox, in the transaction of their command; the relay of `main.ts` delivers to the provider.
    eventPublisher: scopedPublisher(new OutboxPublisher(persistence.outbox), scope),
{{/if}}
{{#unless events.outbox}}
    eventPublisher: scopedPublisher(bus, scope),
{{/unless}}
    eventSubscriber: bus,
{{#if httpCache.perTenant}}
    // The purges of the outbox filed under the tenant of the work, as the answers are tagged (`cacheTags.perTenant`).
    cacheInvalidation: new PublishedCacheInvalidation({
      publisher: scopedPublisher(new OutboxPublisher(persistence.outbox), scope),
      ids,
      clock,
      scope,
      perTenant: true,
    }),
{{/if}}
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

/** What the application is assembled from, once the container is built. */
interface Composed {
  readonly container: Container;
{{#if audit.route}}
  /** The audit sources, built before the container: the HTTP boundary writes the refusals of the guards to them. */
  readonly foundations: Foundations;
{{/if}}
  readonly options: ApplicationOptions;
  readonly contexts: ContextSelection;
}

{{#if audit.route}}
function running({ container, foundations, options, contexts }: Composed): Application {
{{/if}}
{{#unless audit.route}}
function running({ container, options, contexts }: Composed): Application {
{{/unless}}
  const logger = container.resolve(Logger);
{{#if presentation.any}}
  // What the server answers in and which fields each caller sees: the forms and the contract are given the same.
  const presentation = presentationOf(container.resolve(Access), container.resolve(Clock));
{{/if}}

  return {
{{#if http.any}}
{{#if presentation.forms}}
    routes: withForms(routesOf(container, contexts), presentation),
{{/if}}
{{#unless presentation.forms}}
    routes: routesOf(container, contexts),
{{/unless}}
    boundary: httpBoundary({
      authenticator: container.resolve(Authenticator),
      executionScope: container.resolve(ExecutionScope),
      errorMapper: container.resolve(ErrorMapper),
      clock: container.resolve(Clock),
      logger,
{{#if audit.on}}
      refusals: foundations.audit.refusals,
{{/if}}
{{#if errors.sentry}}
      errors: container.resolve(ErrorReporter),
{{/if}}
{{#if presentation.any}}
      presentation,
{{/if}}
    }),
{{/if}}
{{#unless http.any}}
    routes: [],
{{/unless}}
{{#if files.http}}
    fileRoutes: fileRoutes(container.resolve(FileStorage)),
{{/if}}
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
    metrics: container.resolve(Metrics),
    jobs: container.resolve(JobScheduler),
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
