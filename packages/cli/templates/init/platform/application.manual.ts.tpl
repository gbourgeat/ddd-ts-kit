{{#if http.any}}
import type { Authenticator, UseCaseDeclaration } from '@ddd-ts-kit/auth';
import { defineRoutes, type Route } from '@ddd-ts-kit/http';
{{/if}}
{{#unless http.any}}
import type { UseCaseDeclaration } from '@ddd-ts-kit/auth';
{{/unless}}
import type { IntegrationEventPublisher, IntegrationEventSubscriber } from '@ddd-ts-kit/kernel';
{{#if di.nest}}
import { Module, type DynamicModule } from '@nestjs/common';
import { createRoutesModule } from '@ddd-ts-kit/http/nest';
{{/if}}
{{#if http.any}}
import { httpBoundary, type HttpBoundary } from './auth/http-boundary.js';
{{/if}}
import type { Persistence } from './database/persistence.js';
import type { EventProvider } from './events.js';
import { createPlatform, type Platform } from './platform.module.js';
// ddd-ts-kit:imports
// /ddd-ts-kit:imports

interface ContextWiring {
  readonly name: string;
  /** What each command and query of the context requires, or that it is public. */
  readonly useCases: readonly UseCaseDeclaration[];
{{#if http.any}}
  readonly routes: readonly Route[];
{{/if}}
}

export interface ApplicationOptions {
  /** The provider integration events are delivered to: the broker in `main.ts`, the process itself for the tools and most tests. */
  readonly events: EventProvider;
{{#if http.any}}
  /** Who verifies the credential of a request: the real adapter in `main.ts`, a key of their own in the tests. */
  readonly authenticator: Authenticator;
{{/if}}
}

/** Wires one context on the platform. An application hosts all of them here, one alone in `apps/<context>/main.ts`. */
type WireContext = (platform: Platform) => ContextWiring;

const EVERY_CONTEXT: readonly WireContext[] = [
  // ddd-ts-kit:contexts
  // /ddd-ts-kit:contexts
];

export interface Application {
{{#if http.any}}
  readonly routes: readonly Route[];
  /** Authenticates every request and runs it inside the actor context. */
  readonly boundary: HttpBoundary;
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
export function composeApplication(persistence: Persistence, options: ApplicationOptions, selection: readonly WireContext[] = EVERY_CONTEXT): Application {
  const platform = createPlatform(persistence, options.events);
  const contexts = selection.map((wire) => wire(platform));
  platform.protection.declare(contexts.flatMap((context) => context.useCases));
  return {
{{#if http.any}}
    routes: defineRoutes(...contexts.map((context) => context.routes)),
    boundary: httpBoundary(options.authenticator, platform.actors),
{{/if}}
{{#unless http.any}}
    routes: [],
    contexts,
{{/unless}}
    eventBus: platform.eventBus,
    eventSubscriber: platform.subscriber,
    platform,
    start: () => options.events.start(),
    stop: () => options.events.close(),
  };
}
{{#if di.nest}}

@Module({})
class AppModule {}

/** The Nest application: the framework-free routes mounted on its HTTP server. */
export function createAppModule(routes: readonly Route[], boundary: HttpBoundary): DynamicModule {
  return { module: AppModule, imports: [createRoutesModule(routes, boundary)] };
}
{{/if}}
