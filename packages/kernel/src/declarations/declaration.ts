import type { Actor } from '../application/actor.js';
import type { Message, MessageInfo, MessageType, ResultOf } from '../application/bus.js';
import type { IntegrationEvent } from '../application/integration-event.js';
import type { JobOptions, ScheduledJob } from '../application/job.js';
import type { JobSchedule } from '../application/job-schedule.js';
import type { DependencyKind } from '../application/ports.js';
import type { DomainEvent } from '../domain/domain-event.js';
import type { Result } from '../domain/result.js';
import type { Token } from './token.js';

/** Anything a declaration decorator may be written on. */
export type DeclaredClass = abstract new (...args: never) => unknown;

/** The part of a permission a declaration keeps. The authorization package owns the full type. */
export interface PermissionRef {
  readonly id: string;
}

export interface ResourcePointer {
  readonly type: string;
  readonly id: string;
}

/** A field of a message that goes into its audit entry, in the clear or as a keyed hash. */
export type AuditedFieldHint<Name extends string = string> =
  | Name
  | { readonly field: Name; readonly masked: true };

/** Who may send a command or a query, as data. */
export interface AccessDeclaration {
  readonly access: 'public' | 'protected';
  readonly permission?: PermissionRef;
  readonly resourceOf?: (message: Message) => ResourcePointer | undefined;
  readonly contextOf?: (message: Message) => Readonly<Record<string, unknown>> | undefined;
}

export interface MessageDeclaration extends AccessDeclaration {
  readonly role: 'message';
  readonly kind: MessageInfo['kind'];
  /** Read by an audit trail: the fields of the message worth recording. Nothing else is. */
  readonly audited: readonly AuditedFieldHint[];
}

/**
 * What handles a command or a query. `execute` is declared as a property so that the compiler
 * compares its parameter strictly: the handler of another message is rejected.
 */
export interface MessageHandler<M extends Message> {
  readonly execute: (message: M) => Promise<ResultOf<M>>;
}

export interface HandlerDeclaration {
  readonly role: 'command-handler' | 'query-handler';
  readonly message: MessageType<Message>;
  readonly implementation: new (...args: never) => { readonly execute: (message: never) => Promise<unknown> };
  readonly dependencies: readonly Token<unknown>[];
}

/**
 * What an integration event handler needs from the declaration of an integration event. A definition made by
 * `defineIntegrationEvent` of `@ddd-ts-kit/events` fits as it is.
 */
export interface EventContract<Payload> {
  readonly type: string;
  readonly version: number;
  parse(event: IntegrationEvent): Result<IntegrationEvent<Payload>, { readonly reason: string }>;
}

/**
 * A class of `application/integration/handlers/`. `handle` is declared as a property so that
 * the compiler compares its parameter strictly: a handler of another event is rejected.
 */
export interface IntegrationEventHandler<Payload> {
  readonly handle: (event: IntegrationEvent<Payload>) => Promise<void>;
}

export interface IntegrationEventHandlerDeclaration {
  readonly role: 'integration-event-handler';
  readonly event: Pick<EventContract<unknown>, 'type' | 'version'>;
  /** Stable name of the consumer: the idempotency scope and the system actor it runs as. */
  readonly consumer: string;
  readonly actorOf?: (event: IntegrationEvent) => Actor | undefined;
  readonly dependencies: readonly Token<unknown>[];
  /** Hands the contract and the class to `use`, with the payload type the two share. */
  pair<Outcome>(use: IntegrationEventHandlerUse<Outcome>): Outcome;
}

export type IntegrationEventHandlerUse<Outcome> = <Payload>(
  contract: EventContract<Payload>,
  implementation: new (...args: never) => IntegrationEventHandler<Payload>,
) => Outcome;

export type DomainEventType<E extends DomainEvent> = abstract new (...args: never) => E;

/** A class of `application/event-handlers/`: one handler of one domain event of its own context. */
export interface DomainEventHandler<E extends DomainEvent> {
  readonly handle: (event: E) => Promise<void>;
}

export interface DomainEventHandlerDeclaration {
  readonly role: 'domain-event-handler';
  /** The `name` the events of this type carry: what the dispatcher routes by. */
  readonly name: string;
  readonly event: DomainEventType<DomainEvent>;
  readonly dependencies: readonly Token<unknown>[];
  /** Hands the event type and the class to `use`, with the event type the two share. */
  pair<Outcome>(use: DomainEventHandlerUse<Outcome>): Outcome;
}

export type DomainEventHandlerUse<Outcome> = <E extends DomainEvent>(
  event: DomainEventType<E>,
  implementation: new (...args: never) => DomainEventHandler<E>,
) => Outcome;

/** What an aspect is told about the instance it wraps. */
export interface BindingAspectInfo {
  readonly kind?: DependencyKind;
  /** The bound class, or the constructor name of what a factory or a value gave. */
  readonly className: string;
  /** Name of the module that declared the binding. */
  readonly context: string;
  /** Description of the bound token. */
  readonly token: string;
}

/**
 * Cross-cutting behaviour put around one binding: it answers the instance or a stand-in of the
 * same type. An `Aspect` of `@ddd-ts-kit/aspects` fits as it is.
 */
export type BindingAspect = <T extends object>(instance: T, info: BindingAspectInfo) => T;

export interface PortDeclaration {
  readonly role: 'repository' | 'gateway' | 'adapter';
  readonly token: Token<unknown>;
  readonly kind: DependencyKind;
  readonly lifetime: 'singleton' | 'transient';
  /** True when the class takes the place of a binding made by a module listed earlier. */
  readonly replaces: boolean;
  /** Outermost first. */
  readonly aspects: readonly BindingAspect[];
  readonly implementation: new (...args: never) => unknown;
  readonly dependencies: readonly Token<unknown>[];
}

export type PolicyVerdict = { readonly allowed: true } | { readonly allowed: false; readonly reason: string };

/**
 * A rule that needs loaded state, as a class of `application/authorization/`. `allows` uses
 * method syntax on purpose: a method parameter is compared bivariantly, so policies about
 * different subjects can be listed together.
 */
export interface DeclaredPolicy {
  appliesTo?(subject: unknown): boolean;
  allows(actor: Actor, subject: unknown, context: { readonly now: Date }): boolean | PolicyVerdict;
}

export interface PolicyDeclaration {
  readonly role: 'policy';
  /** Stable: it is the reason of the refusal when `allows` answers `false`. */
  readonly name: string;
  readonly permission: PermissionRef;
  readonly implementation: new (...args: never) => DeclaredPolicy;
  readonly dependencies: readonly Token<unknown>[];
}

export interface JobDeclaration {
  readonly role: 'job';
  /** `<context>.<job-name>`: the system actor the job runs as, its lock and its metrics label. */
  readonly name: string;
  readonly schedule: JobSchedule;
  /** As written: the defaults are filled in where the job is registered. */
  readonly options: JobOptions;
  readonly implementation: new (...args: never) => ScheduledJob;
  readonly dependencies: readonly Token<unknown>[];
}

/** What a class said about itself. Plain data: reading it instantiates and resolves nothing. */
export type Declaration =
  | MessageDeclaration
  | HandlerDeclaration
  | IntegrationEventHandlerDeclaration
  | DomainEventHandlerDeclaration
  | PortDeclaration
  | PolicyDeclaration
  | JobDeclaration;
