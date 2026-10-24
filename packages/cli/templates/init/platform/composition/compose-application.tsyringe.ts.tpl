import { installAspectRuntime } from '@ddd-ts-kit/aspects';
{{#if http.any}}
{{#if presentation.any}}
import { Access, Authenticator } from '@ddd-ts-kit/auth';
{{/if}}
{{#unless presentation.any}}
import { Authenticator } from '@ddd-ts-kit/auth';
{{/unless}}
{{/if}}
import {
{{#if routes.declaredControllers}}
  DeclaredEdges,
{{/if}}
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
{{#if routes.mountsControllers}}
import { ErrorMapper, controllerRoutes, defineRoutes, type Route } from '@ddd-ts-kit/http';
{{/if}}
{{#unless routes.mountsControllers}}
import { ErrorMapper, defineRoutes, type Route } from '@ddd-ts-kit/http';
{{/unless}}
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
{{#if files.http}}
  FileStorage,
{{/if}}
{{#if files.any}}
  InMemoryFileStorage,
{{/if}}
{{#unless broker.external}}
  IntegrationEventSubscriber,
{{/unless}}
  Logger,
  Metrics,
{{#if httpCache.perTenant}}
  PublishedCacheInvalidation,
{{/if}}
{{#if http.any}}
  QueryBus,
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
{{#if audit.functionRoute}}
import { searchAuditEntriesRoute } from '{{alias.platform}}/audit/search-audit-entries/search-audit-entries.route{{alias.ext}}';
{{/if}}
{{#if audit.controller}}
import { SearchAuditEntriesController } from '{{alias.platform}}/audit/search-audit-entries/search-audit-entries.controller{{alias.ext}}';
{{/if}}
import { authorization } from '{{alias.platform}}/auth/authorization/authorization{{alias.ext}}';
{{#if routes.mountsControllers}}
import { securitySchemes } from '{{alias.platform}}/auth/authentication/security-schemes{{alias.ext}}';
{{/if}}
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
{{#if privacy.on}}
import { privacyModule } from '{{alias.platform}}/privacy/privacy.module{{alias.ext}}';
{{/if}}
import { layFoundations, type Foundations } from '{{alias.platform}}/composition/lay-foundations{{alias.ext}}';
import { platformModule, type PlatformOptions } from '{{alias.platform}}/composition/platform.module{{alias.ext}}';
// ddd-ts-kit:imports
// /ddd-ts-kit:imports

export interface ApplicationOptions extends PlatformOptions {
  /** Whether this process runs the scheduled jobs, and their settings; left out (the tools, the tests), no job runs by time. */
  readonly jobs?: JobsOptions;
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
  /** The function routes of each context, given the two buses they call; controllers need no list. */
  readonly routes?: readonly ((commands: CommandBus, queries: QueryBus) => readonly Route[])[];
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
{{#if eventSourcing.on}}
      eventSourcingModule(foundations.eventSourcing),
{{/if}}
      guard,
{{#if audit.on}}
      auditModule(foundations.audit),
{{/if}}
{{#if files.any}}
      filesModule(options.files ?? new InMemoryFileStorage()),
{{/if}}
{{#if privacy.on}}
      privacyModule(),
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

{{#unless routes.mountsControllers}}
  return defineRoutes(...(contexts.routes ?? []).map((routes) => routes(commands, queries)){{#if audit.route}}, [searchAuditEntriesRoute(queries)]{{/if}});
{{/unless}}
{{#if routes.mountsControllers}}
  // Every route that is not public names these schemes in the contract.
  const security = Object.keys(securitySchemes);

  return defineRoutes(
    ...(contexts.routes ?? []).map((routes) => routes(commands, queries)),
{{#if routes.declaredControllers}}
    // The controllers the hosted contexts declare, each built from its constructor.
    controllerRoutes(container.resolve(DeclaredEdges).of('controller'), { resolve: container.resolve, security }),
{{/if}}
{{#if audit.functionRoute}}
    [searchAuditEntriesRoute(queries)],
{{/if}}
{{#if audit.controller}}
    controllerRoutes([new SearchAuditEntriesController(queries)], { security }),
{{/if}}
  );
{{/if}}
}
{{/if}}
