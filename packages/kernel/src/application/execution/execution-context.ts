import type { Actor } from '../actor/actor.js';
import type { Session } from '../session/session.js';
import type { ExecutionContextExtensionValues } from './execution-context-extension-values.js';
import type { ExecutionOrigin } from './execution-origin.js';

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
  /** For the origin `schedule`: the instant the job was due, which is not the instant it started. */
  readonly scheduledAt?: Date;
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
