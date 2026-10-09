import { installAspectRuntime } from '@ddd-ts-kit/aspects';
{{#if http.any}}
import type { Authenticator, UseCaseDeclaration } from '@ddd-ts-kit/auth';
{{/if}}
{{#unless http.any}}
import type { UseCaseDeclaration } from '@ddd-ts-kit/auth';
{{/unless}}
{{#if audit.on}}
import { subscribeAll } from '@ddd-ts-kit/events';
{{/if}}
{{#if http.any}}
import { defineRoutes, type Route } from '@ddd-ts-kit/http';
{{/if}}
{{#if cache.rateLimit}}
import type { IntegrationEventPublisher, IntegrationEventSubscriber, Logger, RateLimiter } from '@ddd-ts-kit/kernel';
{{/if}}
{{#unless cache.rateLimit}}
import type { IntegrationEventPublisher, IntegrationEventSubscriber, Logger } from '@ddd-ts-kit/kernel';
{{/unless}}
{{#if di.nest}}
import { Module, type DynamicModule } from '@nestjs/common';
import { createRoutesModule } from '@ddd-ts-kit/http/nest';
{{/if}}
{{#if audit.on}}
{{#if broker.external}}
import { AUDIT_CONSUMER } from './audit/audit.js';
{{/if}}
{{/if}}
{{#if audit.route}}
import { wireAudit } from './audit/audit.module.js';
{{/if}}
{{#if http.any}}
import { httpBoundary, type HttpBoundary } from './auth/http-boundary.js';
{{/if}}
import type { Persistence } from './database/persistence.js';
import { createPlatform, type Platform, type PlatformOptions } from './platform.module.js';
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

{{#if http.any}}
export interface ApplicationOptions extends PlatformOptions {
  /** Who verifies the credential of a request: the real adapter in `main.ts`, a key of their own in the tests. */
  readonly authenticator: Authenticator;
}
{{/if}}
{{#unless http.any}}
export type ApplicationOptions = PlatformOptions;
{{/unless}}

/** Wires one context on the platform. An application hosts all of them here, one alone in `apps/<context>/main.ts`. */
type WireContext = (platform: Platform) => ContextWiring;

const EVERY_CONTEXT: readonly WireContext[] = [
  // ddd-ts-kit:contexts
  // /ddd-ts-kit:contexts
];

export interface Application {
{{#if http.any}}
  readonly routes: readonly Route[];
  /** Authenticates every request and runs it inside the execution scope. */
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
  readonly logger: Logger;
{{#if cache.rateLimit}}
  /** What the HTTP server asks before anything else: on the Redis protocol server, or in the memory of the process without one. */
  readonly rateLimiter: RateLimiter;
{{/if}}
{{#if cache.redis}}
  /** Whether what the application depends on answers: the readiness probe of the HTTP server. */
  ready(): Promise<boolean>;
{{/if}}
  readonly platform: Platform;
  start(): Promise<void>;
  stop(): Promise<void>;
}

/** Wires every bounded context on the shared platform. Also used to generate the contracts and by the end-to-end tests. */
export function composeApplication(persistence: Persistence, options: ApplicationOptions, selection: readonly WireContext[] = EVERY_CONTEXT): Application {
  const platform = createPlatform(persistence, options);
  const { logger, metrics, cache, clock } = platform;
  installAspectRuntime({ logger, metrics, cache, clock });
{{#if audit.route}}
  const contexts = [...selection, wireAudit].map((wire) => wire(platform));
{{/if}}
{{#unless audit.route}}
  const contexts = selection.map((wire) => wire(platform));
{{/unless}}
  platform.protection.declare(contexts.flatMap((context) => context.useCases));
  return {
{{#if http.any}}
    routes: defineRoutes(...contexts.map((context) => context.routes)),
    boundary: httpBoundary({ authenticator: options.authenticator, executionScope: platform.scope, logger }),
{{/if}}
{{#unless http.any}}
    routes: [],
    contexts,
{{/unless}}
    eventBus: platform.eventBus,
{{#if broker.external}}
    // Behind a broker a listener has queues of its own, under its own name.
    eventSubscriber: platform.subscriberFor('observer'),
{{/if}}
{{#unless broker.external}}
    eventSubscriber: platform.subscriber,
{{/unless}}
    logger,
{{#if cache.rateLimit}}
    rateLimiter: platform.rateLimiter,
{{/if}}
{{#if cache.redis}}
    ready: () => options.redis?.ready() ?? Promise.resolve(true),
{{/if}}
    platform,
{{#if audit.on}}
    start: () => {
      // The audit trail listens to every declared integration event, under a name of its own.
{{#if broker.external}}
      subscribeAll(platform.subscriberFor(AUDIT_CONSUMER), platform.audit.subscriptions);
{{/if}}
{{#unless broker.external}}
      subscribeAll(platform.subscriber, platform.audit.subscriptions);
{{/unless}}
      return options.events.start();
    },
{{/if}}
{{#unless audit.on}}
    start: () => options.events.start(),
{{/unless}}
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
