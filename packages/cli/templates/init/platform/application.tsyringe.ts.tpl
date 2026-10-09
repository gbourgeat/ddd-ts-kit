{{#if http.any}}
import type { Authenticator } from '@ddd-ts-kit/auth';
{{/if}}
import { {{#if http.any}}ACTOR_CONTEXT, {{/if}}createApplication, EVENT_BUS, EVENT_SUBSCRIBER, type Application as Container, type ContextModule, type Decorate{{#if http.any}}, type Token{{/if}} } from '@ddd-ts-kit/di';
{{#if http.any}}
import { defineRoutes, type Route } from '@ddd-ts-kit/http';
{{/if}}
import type { IntegrationEventPublisher, IntegrationEventSubscriber } from '@ddd-ts-kit/kernel';
import { traceDependency, tracedPublisher } from '@ddd-ts-kit/tracing';
import { authorization } from './auth/authorization.js';
{{#if http.any}}
import { httpBoundary, type HttpBoundary } from './auth/http-boundary.js';
{{/if}}
import type { Persistence } from './database/persistence.js';
import type { EventProvider } from './events.js';
import { platformModules } from './platform.module.js';
// ddd-ts-kit:imports
// /ddd-ts-kit:imports

export interface ApplicationOptions {
  /** The provider integration events are delivered to: the broker in `main.ts`, the process itself for the tools and most tests. */
  readonly events: EventProvider;
{{#if http.any}}
  /** Who verifies the credential of a request: the real adapter in `main.ts`, a key of their own in the tests. */
  readonly authenticator: Authenticator;
{{/if}}
}

export interface Application {
{{#if http.any}}
  readonly routes: readonly Route[];
  /** Authenticates every request and runs it inside the actor context. */
  readonly boundary: HttpBoundary;
{{/if}}
{{#unless http.any}}
  readonly routes: readonly never[];
{{/unless}}
  /** The provider integration events are delivered to. */
  readonly eventBus: IntegrationEventPublisher;
  /** Where another context, or a test, listens to what this application publishes. */
  readonly eventSubscriber: IntegrationEventSubscriber;
  readonly container: Container;
  start(): Promise<void>;
  stop(): Promise<void>;
}

/** The contexts an application hosts: all of them here, one alone in `apps/<context>/main.ts`. */
export interface ContextSelection {
  readonly modules: readonly ContextModule[];
{{#if http.any}}
  readonly routes: readonly Token<readonly Route[]>[];
{{/if}}
}

const EVERY_CONTEXT: ContextSelection = {
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

/** Wires the bounded contexts on the shared platform. Also used to generate the contracts and by the end-to-end tests. */
export function composeApplication(persistence: Persistence, options: ApplicationOptions, contexts: ContextSelection = EVERY_CONTEXT): Application {
  const modules = [...platformModules(persistence, options.events), authorization({{#if http.any}}options.authenticator{{/if}}), ...contexts.modules];
  const container = createApplication({ modules, decorate: traceAdapters, authorization: 'required' });
  return {
{{#if http.any}}
    routes: defineRoutes(...contexts.routes.map((routes) => container.resolve(routes))),
    boundary: httpBoundary(options.authenticator, container.resolve(ACTOR_CONTEXT)),
{{/if}}
{{#unless http.any}}
    routes: [],
{{/unless}}
    eventBus: tracedPublisher(container.resolve(EVENT_BUS)),
    eventSubscriber: container.resolve(EVENT_SUBSCRIBER),
    container,
    start: () => container.start().then(() => options.events.start()),
    stop: () => container.stop().then(() => options.events.close()),
  };
}

// Tracing stays out of the contexts: every binding declared with a kind is wrapped here.
const traceAdapters: Decorate = (instance, info) =>
  info.kind !== undefined && typeof instance === 'object' && instance !== null
    ? traceDependency(instance, { kind: info.kind, context: info.context })
    : instance;
