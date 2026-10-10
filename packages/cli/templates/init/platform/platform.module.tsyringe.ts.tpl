import { loggingMiddleware, metricsMiddleware } from '@ddd-ts-kit/aspects';
{{#if http.any}}
import type { Authenticator } from '@ddd-ts-kit/auth';
{{/if}}
import { {{platform.diImports}} } from '@ddd-ts-kit/di';
{{#if events.outbox}}
{{#if audit.on}}
import { OutboxPublisher, subscribeAll } from '@ddd-ts-kit/events';
{{/if}}
{{#unless audit.on}}
import { OutboxPublisher } from '@ddd-ts-kit/events';
{{/unless}}
{{/if}}
{{#unless events.outbox}}
{{#if audit.on}}
import { subscribeAll } from '@ddd-ts-kit/events';
{{/if}}
{{/unless}}
import {
  AsyncLocalStorageExecutionScope,
  InMemoryCommandBus,
{{#if style.explicit}}
  InMemoryDomainEventDispatcher,
{{/if}}
  InMemoryQueryBus,
  SystemClock,
  UuidGenerator,
  scopedPublisher,
  unitOfWorkMiddleware,
  type BusMiddleware,
  type Clock,
{{#if style.explicit}}
  type DomainEventDispatcher,
{{/if}}
  type ExecutionScope,
  type IdGenerator,
{{#if broker.external}}
  type IntegrationEventSubscriber,
{{/if}}
  type Logger,
  type Metrics,
} from '@ddd-ts-kit/kernel';
{{#if cache.relaySignal}}
import { relayWakeUpMiddleware } from '@ddd-ts-kit/redis';
{{/if}}
{{#if events.outbox}}
import { tracedSubscriber } from '@ddd-ts-kit/tracing';
{{/if}}
{{#unless events.outbox}}
import { tracedPublisher, tracedSubscriber } from '@ddd-ts-kit/tracing';
{{/unless}}
{{#if audit.on}}
{{#if broker.external}}
import { AUDIT_CONSUMER, createAudit, type Audit } from './audit/audit.js';
{{/if}}
{{#unless broker.external}}
import { createAudit, type Audit } from './audit/audit.js';
{{/unless}}
{{/if}}
{{#if audit.route}}
import { auditModule } from './audit/audit.module.js';
{{/if}}
import { authorization } from './auth/authorization.js';
{{#unless audit.on}}
import { logDecisions } from './auth/decision-log.js';
{{/unless}}
{{#if cache.redis}}
import type { RedisServices } from './cache.js';
{{/if}}
{{#if style.explicit}}
{{#if persistence.hasDatabase}}
import type { DatabaseContext } from './database/database.js';
{{/if}}
{{/if}}
import type { Persistence } from './database/persistence.js';
import type { EventProvider } from './events.js';
import { createLogger, createMetrics, type LogSettings } from './observability.js';

{{#if style.declared}}
{{#if persistence.hasDatabase}}
import { DATABASE } from './tokens.js';
{{/if}}
// ddd-ts-kit:imports
// /ddd-ts-kit:imports
{{/if}}

{{#if style.explicit}}
export const DOMAIN_EVENTS = token<DomainEventDispatcher>('platform.DomainEventDispatcher');
{{/if}}
{{#if broker.external}}
/** The subscriber of one consuming context: a broker gives each context queues of its own. */
export const CONTEXT_EVENTS = token<(context: string) => IntegrationEventSubscriber>('platform.ContextEvents');
{{/if}}
{{#if style.explicit}}
{{#if persistence.hasDatabase}}
export const DATABASE = token<DatabaseContext>('platform.Database');
{{/if}}
{{/if}}

/** What the platform is built on, beyond the storage: chosen in `main.ts`, defaulted for the tools and the tests. */
export interface PlatformOptions {
  /** The provider integration events are delivered to: the broker in `main.ts`, the process itself for the tools and most tests. */
  readonly events: EventProvider;
{{#if http.any}}
  /** Who verifies the credential of a request: the real adapter in `main.ts`, a key of their own in the tests. */
  readonly authenticator: Authenticator;
{{/if}}
  /** Where log entries go; left out, the application writes nothing. */
  readonly log?: LogSettings;
{{#if cache.redis}}
  /** The Redis protocol server; left out, the cache and the limiter stay in the memory of the process. */
  readonly redis?: RedisServices;
{{/if}}
}

/**
 * What exists before any module: built once and handed to the kernel module, so that the buses,
 * the logger{{#if audit.on}}, the audit sources{{/if}} and every adapter read one execution scope, one clock and one
 * generator.
 */
interface Foundations {
  readonly scope: ExecutionScope;
  readonly clock: Clock;
  readonly ids: IdGenerator;
  readonly logger: Logger;
  readonly metrics: Metrics;
{{#if audit.on}}
  readonly audit: Audit;
{{/if}}
}

/**
 * The kernel tokens (clock, identifiers, buses, unit of work, event bus, execution scope, logger,
 * metrics, cache) on the persistence of the project, then what this platform adds and the
 * authorization. Replacing a provider happens here and nowhere else.
 */
export function platformModules(persistence: Persistence, options: PlatformOptions): readonly ContextModule[] {
  const foundations = lay(persistence, options);
{{#if audit.on}}
  const guard = authorization({{#if http.any}}options.authenticator, {{/if}}foundations.audit.decisions);
{{/if}}
{{#unless audit.on}}
  const guard = authorization({{#if http.any}}options.authenticator, {{/if}}logDecisions(foundations.logger));
{{/unless}}
  const modules = [kernelOn(persistence, options, foundations), platformOn(persistence, options{{#if audit.on}}, foundations.audit{{/if}}), guard];
{{#if audit.route}}
  return [...modules, auditModule(foundations.audit.trail)];
{{/if}}
{{#unless audit.route}}
  return modules;
{{/unless}}
}

function lay(persistence: Persistence, options: PlatformOptions): Foundations {
  const scope = new AsyncLocalStorageExecutionScope();
  const clock = new SystemClock();
  const ids = new UuidGenerator();
  return {
    scope,
    clock,
    ids,
    logger: createLogger(scope, options.log),
    metrics: createMetrics(),
{{#if audit.on}}
    audit: createAudit(persistence, { scope, clock, ids }),
{{/if}}
  };
}

function kernelOn(persistence: Persistence, options: PlatformOptions, foundations: Foundations): ContextModule {
  const { bus } = options.events;
  const { scope, clock, ids, logger, metrics } = foundations;
{{#if cache.redis}}
  const { redis } = options;
{{/if}}
  return kernelModule({
    clock,
    ids,
    executionScope: scope,
    logger,
    metrics,
    unitOfWork: persistence.unitOfWork,
    processedEvents: persistence.processedEvents,
    commandBus: (resolve) => commandBus(resolve, foundations, beforeTheTransaction(foundations, options)),
    queryBus: (resolve) => queryBus(resolve, foundations),
    eventBus: bus,
{{#if events.outbox}}
    eventPublisher: scopedPublisher(new OutboxPublisher(persistence.outbox), scope),
{{/if}}
{{#unless events.outbox}}
    eventPublisher: scopedPublisher(tracedPublisher(bus), scope),
{{/unless}}
    eventSubscriber: tracedSubscriber(bus),
{{#if cache.redis}}
    ...(redis === undefined ? {} : { cache: redis.cache(metrics), rateLimiter: redis.rateLimiter }),
{{/if}}
  });
}

function platformOn(persistence: Persistence, options: PlatformOptions{{#if audit.on}}, audit: Audit{{/if}}): ContextModule {
  return defineContextModule({
    name: 'platform',
    register(builder) {
{{#if style.explicit}}
      builder.bind(DOMAIN_EVENTS).toClass(InMemoryDomainEventDispatcher);
{{/if}}
{{#if broker.external}}
      builder.bind(CONTEXT_EVENTS).toValue((context) => tracedSubscriber(options.events.subscriberFor(context)));
{{/if}}
{{#if persistence.hasDatabase}}
      builder.bind(DATABASE).toValue(persistence.database);
{{/if}}
{{#if style.declared}}
      // ddd-ts-kit:bindings
      // /ddd-ts-kit:bindings
{{/if}}
    },
{{#if audit.on}}
    onStart({ resolve }) {
{{#if broker.external}}
      subscribeAll(resolve(CONTEXT_EVENTS)(AUDIT_CONSUMER), audit.subscriptions);
{{/if}}
{{#unless broker.external}}
      subscribeAll(resolve(EVENT_SUBSCRIBER), audit.subscriptions);
{{/unless}}
    },
{{/if}}
  });
}

/**
 * What runs on the command bus between the permission and the unit of work{{#if audit.on}}: the audit entry opens
 * the transaction itself, so that the entry of a success commits with the state change and the
 * entry of a failure survives the rollback{{/if}}.
 */
function beforeTheTransaction(foundations: Foundations, options: PlatformOptions): readonly BusMiddleware[] {
  return [
{{#if cache.relaySignal}}
    ...(options.redis === undefined ? [] : [relayWakeUpMiddleware(options.redis.relaySignal)]),
{{/if}}
{{#if audit.on}}
    foundations.audit.commands,
{{/if}}
  ];
}

/**
 * Around every command, outermost first: the log entry and the measure of the use case, the
 * permission, what runs before the transaction, then the unit of work. The guard and the unit of
 * work are resolved at each command: building the bus must not open anything.
 */
function commandBus(resolve: Resolve, { logger, metrics }: Foundations, beforeCommit: readonly BusMiddleware[]): InMemoryCommandBus {
  const guarded = new InMemoryCommandBus().use(loggingMiddleware(logger)).use(metricsMiddleware(metrics)).use(guardOf(resolve));
  return beforeCommit.reduce((bus, middleware) => bus.use(middleware), guarded).use(unitOfWorkMiddleware({ run: (work) => resolve(UNIT_OF_WORK).run(work) }));
}

function queryBus(resolve: Resolve, { logger, metrics{{#if audit.on}}, audit{{/if}} }: Foundations): InMemoryQueryBus {
  return new InMemoryQueryBus().use(loggingMiddleware(logger)).use(metricsMiddleware(metrics)).use(guardOf(resolve)){{#if audit.on}}.use(audit.queries){{/if}};
}

const guardOf =
  (resolve: Resolve): BusMiddleware =>
  (message, next, info) =>
    resolve(USE_CASE_GUARD)(message, next, info);

/** The platform of a handler spec: no storage behind it, so every repository a test touches has to be faked. */
export const platformTestModule = defineContextModule({
  name: 'platform',
  register(builder) {
{{#if style.explicit}}
    builder.bind(DOMAIN_EVENTS).toClass(InMemoryDomainEventDispatcher);
{{/if}}
{{#if broker.external}}
    builder.bind(CONTEXT_EVENTS).toFactory((resolve) => () => resolve(EVENT_SUBSCRIBER));
{{/if}}
{{#if persistence.hasDatabase}}
    builder.bind(DATABASE).toFactory(() => {
      throw new Error('A handler spec has no database: give a fake for the repository it uses.');
    });
{{/if}}
{{#if style.declared}}
    // ddd-ts-kit:test-bindings
    // /ddd-ts-kit:test-bindings
{{/if}}
  },
});
