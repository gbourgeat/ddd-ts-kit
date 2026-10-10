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
import { createErrorMapper, defineRoutes, type Route } from '@ddd-ts-kit/http';
{{/if}}
{{#if cache.rateLimit}}
import type { IntegrationEventPublisher, IntegrationEventSubscriber, Logger, RateLimiter } from '@ddd-ts-kit/kernel';
{{/if}}
{{#unless cache.rateLimit}}
import type { IntegrationEventPublisher, IntegrationEventSubscriber, Logger } from '@ddd-ts-kit/kernel';
{{/unless}}
{{#if audit.route}}
import { auditModule } from './audit/audit.module.js';
{{/if}}
{{#if http.any}}
import { httpBoundary, type HttpBoundary } from './auth/http-boundary.js';
{{/if}}
{{#if authz.rebac}}
import { relateSystemActors } from './auth/relate-system-actors.js';
{{/if}}
import { createPlatform, type PlatformOptions } from './create-platform.js';
import type { Persistence } from './database/persistence.js';
import type { Platform } from './platform.js';
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
type ContextModule = (platform: Platform) => ContextWiring;

const everyContext: readonly ContextModule[] = [
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
export function composeApplication(persistence: Persistence, options: ApplicationOptions, selection: readonly ContextModule[] = everyContext): Application {
  const platform = createPlatform(persistence, options);
  const { logger, metrics, cache, clock } = platform;

  installAspectRuntime({ logger, metrics, cache, clock });

{{#if audit.route}}
  const contexts = [...selection, auditModule].map((module) => module(platform));
{{/if}}
{{#unless audit.route}}
  const contexts = selection.map((module) => module(platform));
{{/unless}}

  platform.protection.declare(contexts.flatMap((context) => context.useCases));

  return {
{{#if http.any}}
    routes: defineRoutes(...contexts.map((context) => context.routes)),
    boundary: httpBoundary({ authenticator: options.authenticator, executionScope: platform.scope, errorMapper: createErrorMapper(), clock, logger{{#if errors.sentry}}, errors: platform.errors{{/if}} }),
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
    start: () => start(platform, options),
    stop: () => stop(platform, options),
  };
}

/** The consumers first, then the jobs: a job sends commands whose events must find their handlers. */
async function start(platform: Platform, options: ApplicationOptions): Promise<void> {
{{#if authz.rebac}}
  await relateSystemActors();

{{/if}}
{{#if audit.on}}
  // The audit trail listens to every declared integration event, under a name of its own.
{{#if broker.external}}
  subscribeAll(platform.subscriberFor(platform.audit.consumer), platform.audit.subscriptions);
{{/if}}
{{#unless broker.external}}
  subscribeAll(platform.subscriber, platform.audit.subscriptions);
{{/unless}}
{{/if}}
  await options.events.start();

  if (options.jobs?.start === true) await platform.jobs.start();
}

/**
 * The jobs first, then the provider{{#if errors.sentry}}; what failed on the way is given two seconds to reach the
 * tracker{{/if}}; the logger last, flushed by hand since nothing here does it: whatever logs has closed
 * before, and nothing may log after `stop()` returned.
 */
async function stop(platform: Platform, options: ApplicationOptions): Promise<void> {
  await platform.jobs.stop();
  await options.events.close();
{{#if errors.sentry}}
  await platform.errors.flush(2_000);
{{/if}}
  await platform.logger.flush();
}
