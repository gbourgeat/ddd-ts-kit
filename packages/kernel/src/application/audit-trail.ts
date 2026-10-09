import type { ActorType } from './actor.js';
import type { ExecutionOrigin } from './execution-context.js';
import type { Page, PageRequest } from './page.js';

/**
 * The write side of the audit trail: append only. There is no update and no delete, here or
 * in any adapter: an entry that turns out to be wrong is corrected by another entry. Fed by
 * infrastructure and cross-cutting code, never by a use case or an aggregate.
 */
export interface AuditTrail {
  record(record: AuditRecord): Promise<void>;
}

/**
 * The read side, a port of its own: who may read the trail is a decision of the application,
 * and most code that records never reads. The first sort of the request decides the order
 * (default `occurredAt` ascending). An offset page carries `total`, a cursor page `nextCursor`.
 */
export interface AuditReader {
  list(filter: AuditFilter, page: PageRequest<AuditSortField>): Promise<Page<AuditEntry>>;
}

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

/** What a source hands to the trail. The trail gives it a chain, a position and its hashes. */
export type AuditRecord = Omit<AuditEntry, 'chain' | 'sequence' | 'previousHash' | 'hash' | 'extensions'> &
  Partial<Pick<AuditEntry, 'extensions'>>;

/** The standard categories come first; any other string names a category of the project. */
export type AuditCategory =
  | 'authorization'
  | 'command'
  | 'query'
  | 'integration-event'
  | 'authentication'
  | 'data-access'
  | (string & Record<never, never>);

export type AuditOutcome = 'allowed' | 'denied' | 'succeeded' | 'failed';

/** Who acted, as identifiers only: never a name, an email or a role list. */
export interface AuditActor {
  readonly id: string;
  /** `unknown` when a decision concerned somebody else than the actor of the work in progress. */
  readonly type: ActorType | 'unknown';
  readonly tenantId?: string;
}

export interface AuditResource {
  readonly type: string;
  readonly id: string;
}

/** The declared fields of what was done, and nothing else. Absent by default. */
export type AuditChanges = Readonly<Record<string, AuditChange>>;

export type AuditChange = AuditScalar | MaskedValue;

export type AuditScalar = string | number | boolean | null;

/** A value stored as a keyed hash: equality can be checked, the value cannot be read back. */
export interface MaskedValue {
  readonly masked: string;
}

/**
 * What a project adds to every entry, by declaration merging:
 *
 *     declare module '@ddd-ts-kit/kernel' {
 *       interface AuditEntryExtensions { readonly region: 'eu' | 'us' }
 *     }
 */
export interface AuditEntryExtensions {}

/** The extensions as an entry carries them: each one optional, and `never` when it is not JSON. */
export type AuditEntryExtensionValues = {
  readonly [Key in keyof AuditEntryExtensions]?: AuditEntryExtensions[Key] extends AuditJson
    ? AuditEntryExtensions[Key]
    : never;
};

/** What an extension may hold: plain JSON, so that it is hashed and stored as it is. */
export type AuditJson = AuditScalar | readonly AuditJson[] | { readonly [key: string]: AuditJson };

export interface AuditFilter {
  readonly chain?: string;
  readonly tenantId?: string;
  readonly actorId?: string;
  /** Every entry about one resource, or about every resource of a type when `id` is absent. */
  readonly resource?: { readonly type: string; readonly id?: string };
  readonly action?: string;
  readonly category?: AuditCategory;
  readonly outcome?: AuditOutcome;
  /** `occurredAt` at or after this instant. */
  readonly from?: Date;
  /** `occurredAt` strictly before this instant. */
  readonly to?: Date;
  readonly correlationId?: string;
  /** Positions of a chain, both included. Meant to be used with `chain`. */
  readonly fromSequence?: number;
  readonly toSequence?: number;
}

/**
 * `occurredAt` orders by instant, then chain, then sequence: the order a person reads in.
 * `sequence` orders by chain, then sequence: the order a chain is verified in.
 */
export type AuditSortField = 'occurredAt' | 'sequence';
