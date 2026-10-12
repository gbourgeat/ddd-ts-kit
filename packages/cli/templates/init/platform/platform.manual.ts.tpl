import type { AspectInfo } from '@ddd-ts-kit/aspects';
import type { Access } from '@ddd-ts-kit/auth';
import type {
  ActorContext,
  Cache,
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
  JobScheduler,
  Logger,
  Metrics,
  {{#if cache.rateLimit}}
  RateLimiter,
  {{/if}}
} from '@ddd-ts-kit/kernel';
{{#if audit.on}}
import type { Audit } from '{{alias.platform}}/audit/create-audit{{alias.ext}}';
{{/if}}
import type { UseCaseProtection } from '{{alias.platform}}/auth/use-case-protection{{alias.ext}}';
import type { Persistence } from '{{alias.platform}}/database/persistence{{alias.ext}}';

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
  {{#if cache.rateLimit}}
  readonly rateLimiter: RateLimiter;
  {{/if}}
  /** Where a context registers its scheduled jobs; the application starts it when this process runs the jobs. */
  readonly jobs: JobScheduler;
  readonly adapter: Adapt;
  /** The same, for an adapter that states its own policy, as aspects or as decorators on its class. */
  readonly selfGoverned: Adapt;
  readonly protection: UseCaseProtection;
  {{#if audit.on}}
  readonly audit: Audit;
  {{/if}}
}
