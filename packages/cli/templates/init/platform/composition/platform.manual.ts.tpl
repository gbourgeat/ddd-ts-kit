import type { AspectInfo } from '@ddd-ts-kit/aspects';
import type { Access } from '@ddd-ts-kit/auth';
import type {
  ActorContext,
  Cache,
  {{#if httpCache.varnish}}
  CacheInvalidation,
  {{/if}}
  Clock,
  DomainEventDispatcher,
  {{#if errors.sentry}}
  ErrorReporter,
  {{/if}}
  ExecutionScope,
  IdGenerator,
  InMemoryCommandBus,
  InMemoryQueryBus,
  IntegrationEventPublisher,
  IntegrationEventSubscriber,
  JobQueue,
  JobScheduler,
  Logger,
  Metrics,
  ProcessRunner,
  {{#if cache.rateLimit}}
  RateLimiter,
  {{/if}}
} from '@ddd-ts-kit/kernel';
{{#if audit.on}}
import type { Audit } from '{{alias.platform}}/audit/create-audit{{alias.ext}}';
{{/if}}
import type { UseCaseProtection } from '{{alias.platform}}/auth/authorization/use-case-protection{{alias.ext}}';
import type { Persistence } from '{{alias.platform}}/database/persistence{{alias.ext}}';
{{#if eventSourcing.on}}
import type { EventSourcing } from '{{alias.platform}}/event-sourcing/create-event-sourcing{{alias.ext}}';
{{/if}}
{{#if files.any}}
import type { Files } from '{{alias.platform}}/files/create-files{{alias.ext}}';
{{/if}}
import type { BackgroundJobs } from '{{alias.platform}}/jobs/background-jobs{{alias.ext}}';

/** Wraps an adapter from outside: a span for its kind and, for what leaves the process, the default policy unless it states its own. */
type Adapt = <T extends object>(instance: T, info: AspectInfo) => T;

/** The technical capabilities every context receives. */
export interface Platform {
  /** The in-process buses: contexts register their handlers on them, routes and integration event handlers only see the `CommandBus` and `QueryBus` ports. */
  readonly commands: InMemoryCommandBus;
  readonly queries: InMemoryQueryBus;
  readonly clock: Clock;
  readonly ids: IdGenerator;
  readonly domainEvents: DomainEventDispatcher;
  /** What use cases publish through. */
  readonly publisher: IntegrationEventPublisher;
  readonly subscriber: IntegrationEventSubscriber;
  {{#if broker.external}}

  /** The subscriber of one consuming context: a broker gives each context queues of its own. */
  subscriberFor(context: string): IntegrationEventSubscriber;

  {{/if}}
  /** The provider itself: what the outbox relay delivers to. */
  readonly eventBus: IntegrationEventPublisher;
  readonly persistence: Persistence;
  /** Asks the policies about one element, then the authorizer: for the rules that need loaded state. */
  readonly access: Access;
  /**
   * The work in progress (correlation id, actor, tenant), for infrastructure only: audit
   * columns, tenant scoping, consumed events. Use cases get the actor in their message.
   */
  readonly scope: ExecutionScope;
  /** The actor of the execution scope, for an adapter written against `ActorContext`. */
  readonly actors: ActorContext;
  readonly logger: Logger;
  readonly metrics: Metrics;
  {{#if errors.sentry}}
  /** Where what stands around the use cases reports an unexpected failure: the buses, the jobs, the HTTP boundary. A handler throws and never calls it. */
  readonly errors: ErrorReporter;
  {{/if}}
  readonly cache: Cache;
  {{#if httpCache.varnish}}
  /** What a before-commit handler asks to purge from Varnish: the purge runs after the commit, through the outbox. */
  readonly cacheInvalidation: CacheInvalidation;
  {{/if}}
  {{#if cache.rateLimit}}
  readonly rateLimiter: RateLimiter;
  {{/if}}
  /** Where a context registers its scheduled jobs; the application starts it when this process runs the jobs. */
  readonly jobs: JobScheduler;
  /** What a use case enqueues through: a background job is written with its command and run later by the worker, as the actor that enqueued it. */
  readonly jobQueue: JobQueue;
  /** Where a context registers its background jobs; the application starts it when this process runs the jobs. */
  readonly backgroundJobs: BackgroundJobs;
  /** Runs the steps of the process managers, in the unit of work of the step, and delivers their timeouts through the queue. */
  readonly processes: ProcessRunner;
  readonly adapter: Adapt;
  /** The same, for an adapter that states its own policy, as aspects or as decorators on its class. */
  readonly selfGoverned: Adapt;
  readonly protection: UseCaseProtection;
  {{#if audit.on}}
  readonly audit: Audit;
  {{/if}}
  {{#if eventSourcing.on}}
  /** The event store, the keys of the data subjects{{#if audit.on}}, audited,{{/if}} and the cipher of the personal values of the stored events: what an event-sourced repository adapter loads, saves and seals through{{#if privacy.on}}, and whose keys `scripts/privacy-erase.ts` destroys{{/if}}. */
  readonly eventSourcing: EventSourcing;
  {{/if}}
  {{#if files.any}}
  /** Where files live, the keys they are stored under and the staging that keeps them consistent with the database: never their content in a table. */
  readonly files: Files;
  {{/if}}
}
