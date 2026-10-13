import type { DependencyKind, JobPolicy } from '@ddd-ts-kit/kernel';
import type { BindingSource } from '../wiring/binding-source.js';
import type { Lifetime } from '../wiring/lifetime.js';

/**
 * Where a binding comes from. A binding written in a module is `explicit` and carries none of
 * these fields; one made by a declaration decorator carries `origin: 'declared'`, the class
 * that declared it and, when discovery loaded it, the file.
 */
export interface OriginDescription {
  readonly origin?: 'declared';
  readonly declaredBy?: string;
  readonly file?: string;
}

export interface BindingDescription extends OriginDescription {
  readonly token: string;
  readonly module: string;
  readonly kind?: DependencyKind;
  readonly lifetime: Lifetime;
  readonly source: BindingSource;
  /** Class name, for a `class` source. */
  readonly implementation?: string;
  /** Declared by classes only: a factory resolves what it wants at run time. */
  readonly dependencies: readonly string[];
  /** True when an override stands in for this binding. */
  readonly overridden: boolean;
}

export interface HandlerDescription extends OriginDescription {
  readonly message: string;
  readonly handler: string;
  readonly module: string;
  /** Absent when the module declared no access for the use case. */
  readonly access?: 'public' | 'protected';
  /** The id of the required permission, for a protected use case. */
  readonly permission?: string;
}

export interface IntegrationEventHandlerDescription extends OriginDescription {
  readonly event: string;
  readonly version: number;
  readonly consumer: string;
  readonly handler: string;
  readonly module: string;
}

/** A handler of a domain event of its own context. */
export interface DomainEventHandlerDescription extends OriginDescription {
  readonly event: string;
  readonly name: string;
  /** `before-commit`: inside the transaction of the unit of work; `after-commit`: once it has committed. */
  readonly phase: 'before-commit' | 'after-commit';
  readonly handler: string;
  readonly module: string;
}

export interface PolicyDescription extends OriginDescription {
  readonly name: string;
  readonly permission: string;
  readonly policy: string;
  readonly module: string;
}

/** A job as it will run: the settings of the application applied, the defaults filled in. */
export interface ScheduledJobDescription extends OriginDescription, JobPolicy {
  readonly name: string;
  /** `every 15m`, `cron 0 7 * * 1-5 (Europe/Paris)`. */
  readonly schedule: string;
  readonly job: string;
  readonly module: string;
}

/** One event a projection applies: an integration event with its version, or a domain event of its own context. */
export interface AppliedEventDescription {
  readonly kind: 'integration' | 'domain';
  readonly event: string;
  readonly version?: number;
  readonly method: string;
}

/** A declared projection. Its events are subscribed under its name, and are not listed among the handlers. */
export interface ProjectionDescription extends OriginDescription {
  readonly name: string;
  readonly projection: string;
  readonly module: string;
  /** `dispatch`, or `event-store` for a projection a catch-up subscription feeds. */
  readonly feed: 'dispatch' | 'event-store';
  readonly applies: readonly AppliedEventDescription[];
}

/** The wiring as plain, serializable data: ports and classes appear by name. */
export interface WiringDescription {
  readonly modules: readonly string[];
  readonly bindings: readonly BindingDescription[];
  readonly commands: readonly HandlerDescription[];
  readonly queries: readonly HandlerDescription[];
  readonly integrationEventHandlers: readonly IntegrationEventHandlerDescription[];
  /** The declared handlers of domain events. */
  readonly domainEventHandlers: readonly DomainEventHandlerDescription[];
  /** The declared policy classes. */
  readonly policies: readonly PolicyDescription[];
  /** The declared jobs. What they did last and when they run next is asked to the job scheduler. */
  readonly jobs: readonly ScheduledJobDescription[];
  /** The declared projections, each with the events it applies. */
  readonly projections: readonly ProjectionDescription[];
  /** Every overridden token, including those no module binds. */
  readonly overrides: readonly string[];
}
