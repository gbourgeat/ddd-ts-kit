import { createApplication, EVENT_BUS, EVENT_SUBSCRIBER, type Application as Container, type ContextModule, type Decorate{{#if http.any}}, type Token{{/if}} } from '@ddd-ts-kit/di';
{{#if http.any}}
import { defineRoutes, type Route } from '@ddd-ts-kit/http';
{{/if}}
import type { IntegrationEventPublisher, IntegrationEventSubscriber } from '@ddd-ts-kit/kernel';
import { traceDependency, tracedPublisher } from '@ddd-ts-kit/tracing';
import type { Persistence } from './database/persistence.js';
import { platformModules } from './platform.module.js';
// ddd-ts-kit:imports
// /ddd-ts-kit:imports

export interface Application {
{{#if http.any}}
  readonly routes: readonly Route[];
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

/** Wires every bounded context on the shared platform. Also used to generate the contracts and by the end-to-end tests. */
export function composeApplication(persistence: Persistence): Application {
  const modules: readonly ContextModule[] = [
    ...platformModules(persistence),
    // ddd-ts-kit:contexts
    // /ddd-ts-kit:contexts
  ];
  const container = createApplication({ modules, decorate: traceAdapters });
{{#if http.any}}
  const routeTokens: readonly Token<readonly Route[]>[] = [
    // ddd-ts-kit:routes
    // /ddd-ts-kit:routes
  ];
{{/if}}
  return {
{{#if http.any}}
    routes: defineRoutes(...routeTokens.map((routes) => container.resolve(routes))),
{{/if}}
{{#unless http.any}}
    routes: [],
{{/unless}}
    eventBus: tracedPublisher(container.resolve(EVENT_BUS)),
    eventSubscriber: container.resolve(EVENT_SUBSCRIBER),
    container,
    start: () => container.start(),
    stop: () => container.stop(),
  };
}

// Tracing stays out of the contexts: every binding declared with a kind is wrapped here.
const traceAdapters: Decorate = (instance, info) =>
  info.kind !== undefined && typeof instance === 'object' && instance !== null
    ? traceDependency(instance, { kind: info.kind, context: info.context })
    : instance;
