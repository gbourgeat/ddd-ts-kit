{{#if http.any}}
import { defineRoutes, type Route } from '@ddd-ts-kit/http';
{{/if}}
import type { IntegrationEventPublisher, IntegrationEventSubscriber } from '@ddd-ts-kit/kernel';
{{#if di.nest}}
import { Module, type DynamicModule } from '@nestjs/common';
import { createRoutesModule } from '@ddd-ts-kit/http/nest';
{{/if}}
import type { Persistence } from './database/persistence.js';
import { createPlatform, type Platform } from './platform.module.js';
// ddd-ts-kit:imports
// /ddd-ts-kit:imports

interface ContextWiring {
  readonly name: string;
{{#if http.any}}
  readonly routes: readonly Route[];
{{/if}}
}

export interface Application {
{{#if http.any}}
  readonly routes: readonly Route[];
{{/if}}
{{#unless http.any}}
  readonly routes: readonly never[];
  readonly contexts: readonly ContextWiring[];
{{/unless}}
  /** The provider integration events are delivered to. */
  readonly eventBus: IntegrationEventPublisher;
  /** Where another context, or a test, listens to what this application publishes. */
  readonly eventSubscriber: IntegrationEventSubscriber;
  readonly platform: Platform;
  start(): Promise<void>;
  stop(): Promise<void>;
}

/** Wires every bounded context on the shared platform. Also used to generate the contracts and by the end-to-end tests. */
export function composeApplication(persistence: Persistence): Application {
  const platform = createPlatform(persistence);
  const contexts: readonly ContextWiring[] = [
    // ddd-ts-kit:contexts
    // /ddd-ts-kit:contexts
  ];
  return {
{{#if http.any}}
    routes: defineRoutes(...contexts.map((context) => context.routes)),
{{/if}}
{{#unless http.any}}
    routes: [],
    contexts,
{{/unless}}
    eventBus: platform.eventBus,
    eventSubscriber: platform.subscriber,
    platform,
    start: () => Promise.resolve(),
    stop: () => Promise.resolve(),
  };
}
{{#if di.nest}}

@Module({})
class AppModule {}

/** The Nest application: the framework-free routes mounted on its HTTP server. */
export function createAppModule(routes: readonly Route[]): DynamicModule {
  return { module: AppModule, imports: [createRoutesModule(routes)] };
}
{{/if}}
