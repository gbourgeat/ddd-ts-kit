import { aspects, installAspectRuntime } from '@ddd-ts-kit/aspects';
import {
  CACHE,
  CLOCK,
{{#if composition.buses}}
  COMMAND_BUS,
{{/if}}
  EVENT_BUS,
{{#unless broker.external}}
  EVENT_SUBSCRIBER,
{{/unless}}
{{#if http.any}}
  EXECUTION_SCOPE,
{{/if}}
  LOGGER,
  METRICS,
{{#if composition.buses}}
  QUERY_BUS,
{{/if}}
{{#if cache.rateLimit}}
  RATE_LIMITER,
{{/if}}
{{#if composition.contextModule}}
  contextModule,
{{/if}}
  createApplication,
  type Application as Container,
  type ContextModule,
{{#if assembly.discovery}}
  type DeclaredSource,
{{/if}}
{{#if composition.routeTokens}}
  type Token,
{{/if}}
} from '@ddd-ts-kit/di';
{{#if assembly.discovery}}
import { discoverContext } from '@ddd-ts-kit/di/discovery';
{{/if}}
{{#if http.any}}
import { defineRoutes, type Route } from '@ddd-ts-kit/http';
{{/if}}
import type { {{composition.kernelTypes}} } from '@ddd-ts-kit/kernel';
{{#if broker.external}}
import { tracedPublisher, tracedSubscriber } from '@ddd-ts-kit/tracing';
{{/if}}
{{#unless broker.external}}
import { tracedPublisher } from '@ddd-ts-kit/tracing';
{{/unless}}
{{#if audit.route}}
import { AUDIT_ROUTES } from './audit/audit.module.js';
{{/if}}
{{#if http.any}}
import { httpBoundary, type HttpBoundary } from './auth/http-boundary.js';
{{/if}}
import type { Persistence } from './database/persistence.js';
{{#if composition.listening}}
import { listeningContext } from './listening-context.js';
{{/if}}
import { platformModules, type PlatformOptions } from './platform.module.js';
import { DEFAULT_RESILIENCE, adapterAspects, type ResilienceSettings } from './resilience.js';
// ddd-ts-kit:imports
// /ddd-ts-kit:imports

export interface ApplicationOptions extends PlatformOptions {
  /** The policy around every adapter that leaves the process; left out, the defaults of `resilience.ts`. */
  readonly resilience?: ResilienceSettings;
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
{{#if composition.routeTokens}}
  readonly routes: readonly Token<readonly Route[]>[];
{{/if}}
{{#if composition.buses}}
  /** The routes of each context, given the two buses they call. */
  readonly routes: readonly ((commands: CommandBus, queries: QueryBus) => readonly Route[])[];
{{/if}}
}
{{#if assembly.discovery}}

/** `discoverContext` loads no `*.publisher` file: the reactions that publish integration events are listed here. */
const PUBLISHERS: DeclaredSource = [
  // ddd-ts-kit:publishers
  // /ddd-ts-kit:publishers
];
{{/if}}

const EVERY_CONTEXT: ContextSelection = {
  modules: [
    // ddd-ts-kit:contexts
    // /ddd-ts-kit:contexts
{{#if assembly.discovery}}
    contextModule('publishers', PUBLISHERS),
{{/if}}
  ],
{{#if http.any}}
  routes: [
    // ddd-ts-kit:routes
    // /ddd-ts-kit:routes
  ],
{{/if}}
};

/** Wires the bounded contexts on the shared platform. Also used to generate the contracts and by the end-to-end tests. */
export function composeApplication(persistence: Persistence, options: ApplicationOptions, contexts: ContextSelection = EVERY_CONTEXT): Application {
  const modules = [...platformModules(persistence, options), ...contexts.modules];
  // Cross-cutting behaviour stays out of the contexts: every binding declared with a kind is wrapped here.
  const container = createApplication({ modules, decorate: aspects(adapterAspects(options.resilience ?? DEFAULT_RESILIENCE)), authorization: 'required' });
  const logger = container.resolve(LOGGER);
  installAspectRuntime({ logger, metrics: container.resolve(METRICS), cache: container.resolve(CACHE), clock: container.resolve(CLOCK) });
  return {
{{#if http.any}}
{{#if audit.route}}
    routes: defineRoutes(...contexts.routes.map((routes) => {{composition.routesOf}}), container.resolve(AUDIT_ROUTES)),
{{/if}}
{{#unless audit.route}}
    routes: defineRoutes(...contexts.routes.map((routes) => {{composition.routesOf}})),
{{/unless}}
    boundary: httpBoundary({ authenticator: options.authenticator, executionScope: container.resolve(EXECUTION_SCOPE), logger }),
{{/if}}
{{#unless http.any}}
    routes: [],
{{/unless}}
    eventBus: tracedPublisher(container.resolve(EVENT_BUS)),
{{#if broker.external}}
    // Behind a broker a listener has queues of its own, under its own name.
    eventSubscriber: tracedSubscriber(options.events.subscriberFor('observer')),
{{/if}}
{{#unless broker.external}}
    eventSubscriber: container.resolve(EVENT_SUBSCRIBER),
{{/unless}}
    logger,
{{#if cache.rateLimit}}
    rateLimiter: container.resolve(RATE_LIMITER),
{{/if}}
{{#if cache.redis}}
    ready: () => options.redis?.ready() ?? Promise.resolve(true),
{{/if}}
    container,
    start: () => container.start().then(() => options.events.start()),
    stop: () => container.stop().then(() => options.events.close()),
  };
}
