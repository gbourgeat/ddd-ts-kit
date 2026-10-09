import type { Actor } from './actor.js';
import type { LogFields } from './logger.js';
import type { Session } from './session.js';

/** The standard origins come first; any other string names an origin of the project. */
export type ExecutionOrigin = 'http' | 'event' | 'schedule' | 'cli' | (string & Record<never, never>);

/**
 * What a project adds to every execution context, by declaration merging:
 *
 *     declare module '@ddd-ts-kit/kernel' {
 *       interface ExecutionContextExtensions { readonly region: string }
 *     }
 */
export interface ExecutionContextExtensions {}

/** The extensions as a context carries them: each one optional. */
export type ExecutionContextExtensionValues = {
  readonly [Key in keyof ExecutionContextExtensions]?: ExecutionContextExtensions[Key];
};

/**
 * What every unit of work carries, whatever started it: an HTTP request, a consumed event, a
 * scheduled job, a CLI command. Plain data, set once at the boundary.
 */
export interface ExecutionContext {
  /** The same for everything one external stimulus causes, across processes. */
  readonly correlationId: string;
  /** Id of the message or request that directly caused this unit of work. */
  readonly causationId?: string;
  readonly actor: Actor;
  readonly session?: Session;
  readonly tenantId?: string;
  readonly locale?: string;
  /** The instant after which the result is useless to the caller. */
  readonly deadline?: Date;
  readonly origin: ExecutionOrigin;
  readonly extensions: ExecutionContextExtensionValues;
}

export type ExecutionContextInit = Omit<ExecutionContext, 'extensions' | 'tenantId'> &
  Partial<Pick<ExecutionContext, 'extensions' | 'tenantId'>>;

/** Fills what can be derived: the tenant of the actor, no extension. */
export function executionContext(init: ExecutionContextInit): ExecutionContext {
  const tenantId = init.tenantId ?? init.actor.tenantId;
  return Object.freeze({
    ...init,
    ...(tenantId === undefined ? {} : { tenantId }),
    extensions: init.extensions ?? Object.freeze({}),
  });
}

/**
 * The same unit of work seen as another actor. The session goes: it was the previous actor's.
 * The tenant follows the new actor when it has one.
 */
export function withActor(context: ExecutionContext, actor: Actor): ExecutionContext {
  if (context.actor === actor) return context;
  const { session: _session, tenantId: _tenantId, ...rest } = context;
  const tenantId = actor.tenantId ?? context.tenantId;
  return Object.freeze({ ...rest, actor, ...(tenantId === undefined ? {} : { tenantId }) });
}

export function isPastDeadline(context: ExecutionContext, now: Date): boolean {
  return context.deadline !== undefined && context.deadline.getTime() <= now.getTime();
}

/** The identifiers a log line needs to be found again, impersonation included. Never content. */
export function logFieldsOf(context: ExecutionContext): LogFields {
  return {
    correlationId: context.correlationId,
    origin: context.origin,
    actorId: context.actor.id,
    ...(context.causationId === undefined ? {} : { causationId: context.causationId }),
    ...(context.tenantId === undefined ? {} : { tenantId: context.tenantId }),
    ...(context.session?.impersonatedBy === undefined
      ? {}
      : { impersonatedBy: context.session.impersonatedBy }),
  };
}

/**
 * The execution context of the work in progress, for infrastructure and cross-cutting code
 * that is not handed it: loggers, audit columns, tenant scoping, outgoing headers. Set once at
 * the boundary with `run`. Use cases and the domain never read it: they receive what they need
 * in the command or query.
 */
export interface ExecutionScope {
  current(): ExecutionContext | undefined;
  /** Throws `NoExecutionContextError` outside of `run`. */
  require(): ExecutionContext;
  run<T>(context: ExecutionContext, work: () => T): T;
}

/** A boundary forgot `ExecutionScope.run`: a wiring mistake, never a business failure. */
export class NoExecutionContextError extends Error {
  constructor() {
    super('No execution context: the boundary (route, consumer, job) must call ExecutionScope.run');
    this.name = 'NoExecutionContextError';
  }
}
