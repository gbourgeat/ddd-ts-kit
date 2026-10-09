import type { Actor } from '@ddd-ts-kit/kernel';
import type { Permission } from './permissions.js';

/** One element a right may bear on: `{ type: 'invoice', id: 'inv-1' }`. */
export interface ResourceRef {
  readonly type: string;
  readonly id: string;
}

/** `reason` is a stable machine code (`NO_MATCHING_ROLE`), never a sentence and never data. */
export type Decision = { readonly allowed: true } | { readonly allowed: false; readonly reason: string };

/**
 * What an actor may read of one resource type, in a form a read port turns into a `WHERE`
 * clause. A list is filtered by the query, never in memory after loading.
 */
export type AccessScope =
  | { readonly kind: 'all' }
  | { readonly kind: 'none' }
  | { readonly kind: 'ids'; readonly ids: readonly string[] }
  | { readonly kind: 'filter'; readonly filter: Readonly<Record<string, string | number | boolean>> };

/** Facts about the request that are neither the actor nor the resource. */
export type AuthorizationContext = Readonly<Record<string, unknown>>;

export interface CheckRequest {
  readonly actor: Actor;
  readonly permission: Permission;
  readonly resource?: ResourceRef;
  readonly context?: AuthorizationContext;
}

export interface ListRequest {
  readonly actor: Actor;
  readonly permission: Permission;
  readonly resourceType: string;
}

/**
 * The one port every authorization model implements: roles, attribute policies, relationships,
 * in process or delegated to a dedicated service. Handlers and middleware know nothing else.
 */
export interface Authorizer {
  check(request: CheckRequest): Promise<Decision>;
  /** Absent when the model cannot enumerate: asking for a scope then fails loudly. */
  listAccessible?(request: ListRequest): Promise<AccessScope>;
}

export const ALLOWED: Decision = Object.freeze({ allowed: true });

export function deny(reason: string): Decision {
  return { allowed: false, reason };
}

/** The reasons the authorizers of this package give. An adapter may add its own. */
export const DenialReason = {
  anonymous: 'ANONYMOUS',
  noMatchingRole: 'NO_MATCHING_ROLE',
  tenantMismatch: 'TENANT_MISMATCH',
  explicitDeny: 'EXPLICIT_DENY',
  noMatchingPolicy: 'NO_MATCHING_POLICY',
  subjectMismatch: 'SUBJECT_MISMATCH',
  resourceRequired: 'RESOURCE_REQUIRED',
  unmappedPermission: 'UNMAPPED_PERMISSION',
  noRelation: 'NO_RELATION',
  depthExceeded: 'DEPTH_EXCEEDED',
} as const;

/** What the audit hook receives, for an allowed decision as for a refused one. */
export interface DecisionRecord {
  readonly actorId: string;
  readonly permissionId: string;
  readonly resource?: ResourceRef;
  readonly decision: Decision;
  /** The command or query, when the decision was taken by the bus middleware. */
  readonly useCase?: string;
}

export type OnDecision = (record: DecisionRecord) => void | Promise<void>;

export function decisionRecord(request: CheckRequest, decision: Decision, useCase?: string): DecisionRecord {
  return {
    actorId: request.actor.id,
    permissionId: request.permission.id,
    ...(request.resource === undefined ? {} : { resource: request.resource }),
    decision,
    ...(useCase === undefined ? {} : { useCase }),
  };
}
