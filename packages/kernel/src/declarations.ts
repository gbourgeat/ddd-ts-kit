import type { DomainEvent } from './domain/domain-event.js';
import type { DomainEventHandler, IntegrationEventHandler } from './declarations/event-handlers.js';

export { token, describeToken, type Token } from './declarations/token.js';
export {
  ACTOR_CONTEXT,
  CACHE,
  CLOCK,
  COMMAND_BUS,
  DOMAIN_EVENTS,
  EVENT_BUS,
  EVENT_PUBLISHER,
  EVENT_SUBSCRIBER,
  EXECUTION_SCOPE,
  ID_GENERATOR,
  JOB_SCHEDULER,
  LOCK,
  LOGGER,
  METRICS,
  PROCESSED_EVENTS,
  QUERY_BUS,
  RATE_LIMITER,
  UNIT_OF_WORK,
} from './declarations/standard-tokens.js';
export type {
  AccessDeclaration,
  AuditedFieldHint,
  BindingAspect,
  BindingAspectInfo,
  Declaration,
  DeclaredClass,
  DeclaredPolicy,
  DomainEventHandlerDeclaration,
  DomainEventHandlerUse,
  DomainEventType,
  EventContract,
  HandlerDeclaration,
  IntegrationEventHandlerDeclaration,
  IntegrationEventHandlerUse,
  JobDeclaration,
  MessageDeclaration,
  MessageHandler,
  PermissionRef,
  PolicyDeclaration,
  PolicyVerdict,
  PortDeclaration,
  ResourcePointer,
} from './declarations/declaration.js';
export type {
  ClassDeclarator,
  Dependencies,
  DependencyList,
  DependencyMismatch,
  DependencyTokens,
  MatchingDependencies,
} from './declarations/dependencies.js';
export {
  DeclarationError,
  declarationOf,
  listDeclarations,
  type DeclaredEntry,
} from './declarations/registry.js';
export { Public, Requires, type MessageDeclarator, type ProtectedOptions, type PublicOptions } from './declarations/messages.js';
export { CommandHandler, QueryHandler } from './declarations/handlers.js';
export {
  DomainEventHandler,
  IntegrationEventHandler,
  type DomainEventHandlerOptions,
  type IntegrationEventHandlerOptions,
} from './declarations/event-handlers.js';
export { Scheduled, type ScheduledOptions } from './declarations/scheduled.js';
export type { JobExecution, JobOptions, ScheduledJob } from './application/job.js';
export type { CronSchedule, DurationText, IntervalSchedule, JobSchedule } from './application/job-schedule.js';
export { Adapter, Gateway, Repository, type AdapterOptions, type PortOptions } from './declarations/ports.js';
export { Policy, type PolicyOptions } from './declarations/policy.js';

/** @deprecated Renamed `IntegrationEventHandler`: the decorator and the shape of its class share one name. */
export type IntegrationEventHandlerInstance<Payload> = IntegrationEventHandler<Payload>;

/** @deprecated Renamed `DomainEventHandler`: the decorator and the shape of its class share one name. */
export type DomainEventHandlerInstance<E extends DomainEvent> = DomainEventHandler<E>;
