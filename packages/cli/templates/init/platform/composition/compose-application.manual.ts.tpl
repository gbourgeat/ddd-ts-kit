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
{{#if files.any}}
import { PurgeStagedFiles } from '@ddd-ts-kit/kernel';
{{/if}}
{{#if cache.rateLimit}}
import type { IntegrationEventPublisher, IntegrationEventSubscriber, Logger, RateLimiter } from '@ddd-ts-kit/kernel';
{{/if}}
{{#unless cache.rateLimit}}
import type { IntegrationEventPublisher, IntegrationEventSubscriber, Logger } from '@ddd-ts-kit/kernel';
{{/unless}}
{{#if audit.route}}
import { auditModule } from '{{alias.platform}}/audit/audit.module{{alias.ext}}';
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
import { createPlatform } from '{{alias.platform}}/composition/create-platform{{alias.ext}}';
import type { Persistence } from '{{alias.platform}}/database/persistence{{alias.ext}}';
{{#if files.http}}
import { fileRoutes } from '{{alias.platform}}/files/file-routes{{alias.ext}}';
{{/if}}
import type { Platform } from '{{alias.platform}}/composition/platform{{alias.ext}}';
import type { PlatformOptions } from '{{alias.platform}}/composition/platform-options{{alias.ext}}';
{{#if privacy.on}}
import { runPurge } from '{{alias.platform}}/privacy/run-purge{{alias.ext}}';
{{/if}}
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
{{#if files.http}}
  /** The routes that answer the signed links of a storage the application serves itself; mounted before any body parser. */
  readonly fileRoutes: readonly Route[];
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
export function composeApplication(
  persistence: Persistence,
  options: ApplicationOptions,
  selection: readonly ContextModule[] = everyContext,
): Application {
  const platform = createPlatform(persistence, options);
  const { logger, metrics, cache, clock } = platform;

  installAspectRuntime({ logger, metrics, cache, clock });
{{#if files.any}}
  purgeStagedFiles(platform);
{{/if}}
{{#if privacy.on}}
  purgeExpiredEveryNight(platform);
{{/if}}

{{#if audit.route}}
  const contexts = [...selection, auditModule].map((module) => module(platform));
{{/if}}
{{#unless audit.route}}
  const contexts = selection.map((module) => module(platform));
{{/unless}}

  platform.protection.declare(contexts.flatMap((context) => context.useCases));
{{#if presentation.any}}
  // What the server answers in and which fields each caller sees: the forms and the contract are given the same.
  const presentation = presentationOf(platform.access, clock);
{{/if}}

  return {
{{#if http.any}}
{{#if presentation.forms}}
    routes: withForms(defineRoutes(...contexts.map((context) => context.routes)), presentation),
{{/if}}
{{#unless presentation.forms}}
    routes: defineRoutes(...contexts.map((context) => context.routes)),
{{/unless}}
    boundary: httpBoundary({
      authenticator: options.authenticator,
      executionScope: platform.scope,
      errorMapper: createErrorMapper(),
      clock,
      logger,
{{#if audit.on}}
      refusals: platform.audit.refusals,
{{/if}}
{{#if errors.sentry}}
      errors: platform.errors,
{{/if}}
{{#if presentation.any}}
      presentation,
{{/if}}
    }),
{{/if}}
{{#unless http.any}}
    routes: [],
    contexts,
{{/unless}}
{{#if files.http}}
    fileRoutes: fileRoutes(platform.files.storage),
{{/if}}
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

/**
 * The consumers first, then the jobs: a job sends commands whose events must find their handlers.
 * The worker of the background jobs runs in the process that runs the jobs{{#if queue.memory}}, and in every
 * process while the queue is kept in its memory: no other process would see what this one enqueues{{/if}}.
 */
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

  if (options.jobs?.start === true) {
    await platform.jobs.start();
{{#unless queue.memory}}
    await platform.backgroundJobs.start();
{{/unless}}
  }
{{#if queue.memory}}

  await platform.backgroundJobs.start();
{{/if}}
}

/**
 * The jobs first, the worker next (a job may still enqueue), then the provider{{#if errors.sentry}}; what failed on the
 * way is given two seconds to reach the tracker{{/if}}; the logger last, flushed by hand since nothing here
 * does it: whatever logs has closed before, and nothing may log after `stop()` returned.
 */
async function stop(platform: Platform, options: ApplicationOptions): Promise<void> {
  await platform.jobs.stop();
  await platform.backgroundJobs.stop();
  await options.events.close();
{{#if errors.sentry}}
  await platform.errors.flush(2_000);
{{/if}}
  await platform.logger.flush();
}
{{#if files.any}}

/** What rolled-back commands left in `staging/`, removed every hour by the process that runs the jobs. */
function purgeStagedFiles(platform: Platform): void {
  const purge = new PurgeStagedFiles(platform.files.staging, platform.clock);

  platform.jobs.register({ name: 'files.purge-staged', schedule: { every: '1h' }, run: () => purge.run() });
}
{{/if}}
{{#if privacy.on}}

/** What outlived the retention its declaration gives, purged every night at 03:00 UTC by the process that runs the jobs. */
function purgeExpiredEveryNight(platform: Platform): void {
  platform.jobs.register({
    name: 'privacy.purge-expired',
    schedule: { cron: '0 3 * * *' },
    run: async () => {
      await runPurge(platform);
    },
  });
}
{{/if}}
