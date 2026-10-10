import type { ExecutionOrigin } from '../execution/execution-origin.js';
import type { AuditActor } from './audit-actor.js';
import type { AuditCategory } from './audit-category.js';
import type { AuditChanges } from './audit-changes.js';
import type { AuditEntryExtensionValues } from './audit-entry-extension-values.js';
import type { AuditOutcome } from './audit-outcome.js';
import type { AuditResource } from './audit-resource.js';

/**
 * One fact of the audit trail, as plain data. Identifiers and stable codes only: no message,
 * no payload, no credential. Project fields live under `extensions`, so a standard field added
 * later cannot collide with them.
 */
export interface AuditEntry {
  readonly id: string;
  /** The chain the entry belongs to: `tenant:<id>`, or `global` for work that names no tenant. */
  readonly chain: string;
  /** Position in the chain, starting at 1, without a gap. */
  readonly sequence: number;
  readonly occurredAt: Date;
  readonly category: AuditCategory;
  /** A stable identifier: a permission id, a command name, an event type. */
  readonly action: string;
  readonly outcome: AuditOutcome;
  /** A stable code (`NO_MATCHING_ROLE`, the `code` of a `DomainError`), never a sentence. */
  readonly reason?: string;
  readonly actor: AuditActor;
  /** The tenant of the work in progress, which a support actor does not belong to. */
  readonly tenantId?: string;
  /** Id of the actor acting as `actor`. */
  readonly impersonatedBy?: string;
  readonly sessionId?: string;
  readonly resource?: AuditResource;
  /** Name of the bounded context the action belongs to. */
  readonly context?: string;
  readonly correlationId: string;
  readonly causationId?: string;
  readonly origin: ExecutionOrigin;
  readonly changes?: AuditChanges;
  readonly extensions: AuditEntryExtensionValues;
  /** The `hash` of the entry before this one in the chain; the store that seals the entry says what the first one carries. */
  readonly previousHash: string;
  /** What seals every other field. How it is computed belongs to the store: see `@ddd-ts-kit/audit`. */
  readonly hash: string;
}
