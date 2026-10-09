import type { IntegrationEvent } from '@ddd-ts-kit/kernel';
import type { OutboxRecord, OutboxStats, OutboxStatus, OutboxStore } from '@ddd-ts-kit/events';
import type { PrismaUnitOfWork } from './unit-of-work.js';

/** A JSON value as Prisma accepts it in a `Json` field. */
export type PrismaJsonInput =
  | string
  | number
  | boolean
  | { readonly [key: string]: PrismaJsonInput | null }
  | readonly (PrismaJsonInput | null)[];

/** The outbox model as Prisma returns it: the fields of the shipped schema fragment. */
export interface PrismaOutboxRow {
  readonly id: string;
  readonly type: string;
  readonly version: number;
  readonly occurredAt: string;
  readonly payload: unknown;
  readonly traceparent: string | null;
  readonly correlationId: string | null;
  readonly status: string;
  readonly attempts: number;
  readonly nextAttemptAt: Date;
  readonly lastErrorCode: string | null;
  readonly publishedAt: Date | null;
}

export interface PrismaOutboxInsert {
  id: string;
  type: string;
  version: number;
  occurredAt: string;
  payload?: PrismaJsonInput;
  traceparent: string | null;
  correlationId: string | null;
  nextAttemptAt: Date;
}

export interface PrismaOutboxWhere {
  id?: string | { in: string[] };
  status?: OutboxStatus | { not: OutboxStatus };
  attempts?: number;
  nextAttemptAt?: { lte: Date };
  publishedAt?: { lt: Date };
  lastErrorCode?: { not: null };
}

export interface PrismaOutboxUpdate {
  status?: OutboxStatus;
  attempts?: number | { increment: number };
  nextAttemptAt?: Date;
  lastErrorCode?: string;
  publishedAt?: Date;
}

/**
 * The methods the store calls on the outbox model, typed structurally so the package does not
 * depend on your generated client: `client.outboxRecord` fits as is.
 */
export interface PrismaOutboxDelegate {
  createMany(args: { data: PrismaOutboxInsert[] }): Promise<unknown>;
  findMany(args: {
    where: PrismaOutboxWhere;
    orderBy?: [{ nextAttemptAt: 'asc' }, { sequence: 'asc' }];
    take?: number;
  }): Promise<PrismaOutboxRow[]>;
  updateMany(args: { where: PrismaOutboxWhere; data: PrismaOutboxUpdate }): Promise<{ count: number }>;
  deleteMany(args: { where: PrismaOutboxWhere }): Promise<{ count: number }>;
  count(args: { where: PrismaOutboxWhere }): Promise<number>;
}

/** The raw-query method of a Prisma client, needed for the one statement Prisma cannot build. */
export interface PrismaRawQueries {
  $queryRawUnsafe(query: string, ...values: unknown[]): Promise<unknown>;
}

/**
 * Claims with `SELECT ... FOR UPDATE SKIP LOCKED`. Prisma Client has no row-locking API, so
 * that one statement goes through `$queryRawUnsafe`, which is why the store must be told the
 * dialect and the real name of the table. Needs PostgreSQL or MySQL 8.
 */
export interface PrismaSkipLockedClaim<Tx> {
  readonly strategy: 'skip-locked';
  readonly dialect: 'postgresql' | 'mysql';
  /** The raw-query capability of a client: `(client) => client`. */
  readonly raw: (client: Tx) => PrismaRawQueries;
  /** The schema (PostgreSQL) or database (MySQL) of the table. Default: that of the connection. */
  readonly schema?: string;
  /** The table the model is mapped to. Default `outbox`. */
  readonly table?: string;
}

/**
 * How concurrent relays share the pending records.
 * - `compare-and-set`: reads the due records, then takes each with an `updateMany` guarded by
 *   the attempt count it read. Plain Prisma Client calls, on any database, at one statement
 *   per record.
 * - `skip-locked`: one locking select and one update in a short transaction.
 */
export type PrismaOutboxClaim<Tx> = 'compare-and-set' | PrismaSkipLockedClaim<Tx>;

export interface PrismaOutboxStoreOptions<Tx> {
  /** How to reach the outbox model from a client: `(client) => client.outboxRecord`. */
  readonly delegate: (client: Tx) => PrismaOutboxDelegate;
  /**
   * Required, because Prisma does not tell which database it talks to: choose
   * `compare-and-set`, or describe the table for `skip-locked`.
   */
  readonly claim: PrismaOutboxClaim<Tx>;
  /** How long a claimed record stays invisible to other claims. Default 30000. */
  readonly leaseMs?: number;
}

// A fresh record is due at once, whatever clock the relay runs on.
const DUE_IMMEDIATELY = new Date(0);
const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;

/**
 * The outbox through Prisma Client. `append` runs on the client of the unit of work: called
 * inside `run`, the events are written by the transaction of the command and share its fate,
 * which is the whole point of an outbox.
 */
export class PrismaOutboxStore<Tx> implements OutboxStore {
  readonly #unitOfWork: PrismaUnitOfWork<Tx>;
  readonly #delegate: (client: Tx) => PrismaOutboxDelegate;
  /** Absent when claiming by compare-and-set. */
  readonly #skipLocked: { readonly sql: string; readonly raw: (client: Tx) => PrismaRawQueries } | undefined;
  readonly #leaseMs: number;

  constructor(unitOfWork: PrismaUnitOfWork<Tx>, options: PrismaOutboxStoreOptions<Tx>) {
    this.#unitOfWork = unitOfWork;
    this.#delegate = options.delegate;
    this.#skipLocked =
      options.claim === 'compare-and-set'
        ? undefined
        : { sql: lockingSelect(options.claim), raw: options.claim.raw };
    this.#leaseMs = options.leaseMs ?? 30_000;
  }

  async append(events: readonly IntegrationEvent[]): Promise<void> {
    if (events.length === 0) {
      return;
    }
    await this.#outbox().createMany({
      data: events.map((event) => ({
        id: event.id,
        type: event.type,
        version: event.version,
        occurredAt: event.occurredAt,
        ...payloadField(event.payload),
        traceparent: event.traceparent ?? null,
        correlationId: event.correlationId ?? null,
        nextAttemptAt: DUE_IMMEDIATELY,
      })),
    });
  }

  async claimBatch(limit: number, now: Date): Promise<OutboxRecord[]> {
    if (limit <= 0) {
      return [];
    }
    const claimed =
      this.#skipLocked === undefined
        ? await this.#claimByCompareAndSet(limit, now)
        : await this.#claimSkippingLocked(this.#skipLocked, limit, now);
    const leasedUntil = new Date(now.getTime() + this.#leaseMs);
    return claimed.map((row) => toRecord({ ...row, attempts: row.attempts + 1, nextAttemptAt: leasedUntil }));
  }

  async markPublished(ids: readonly string[], at: Date): Promise<void> {
    if (ids.length === 0) {
      return;
    }
    await this.#outbox().updateMany({
      where: { id: { in: [...ids] } },
      data: { status: 'published', publishedAt: at },
    });
  }

  async markFailed(
    id: string,
    error: { readonly code: string },
    nextAttemptAt: Date | null,
  ): Promise<void> {
    await this.#outbox().updateMany({
      where: { id, status: { not: 'published' } },
      data:
        nextAttemptAt === null
          ? { status: 'dead', lastErrorCode: error.code }
          : { nextAttemptAt, lastErrorCode: error.code },
    });
  }

  async retryDead(ids: readonly string[], now: Date): Promise<number> {
    if (ids.length === 0) {
      return 0;
    }
    const revived = await this.#outbox().updateMany({
      where: { id: { in: [...ids] }, status: 'dead' },
      data: { status: 'pending', attempts: 0, nextAttemptAt: now },
    });
    return revived.count;
  }

  async purgePublished(before: Date): Promise<number> {
    const purged = await this.#outbox().deleteMany({
      where: { status: 'published', publishedAt: { lt: before } },
    });
    return purged.count;
  }

  async stats(): Promise<OutboxStats> {
    const outbox = this.#outbox();
    // One after the other: a transaction client runs one query at a time anyway.
    const pending = await outbox.count({ where: { status: 'pending' } });
    const failed = await outbox.count({ where: { status: 'pending', lastErrorCode: { not: null } } });
    const dead = await outbox.count({ where: { status: 'dead' } });
    return { pending, failed, dead };
  }

  /**
   * Takes each due row with an update that only applies if nobody claimed it since it was
   * read: every claim increments `attempts`, so an unchanged count on a row that is still due
   * means the row is free. Rows lost to another relay are replaced by reading again.
   */
  async #claimByCompareAndSet(limit: number, now: Date): Promise<PrismaOutboxRow[]> {
    const claimed: PrismaOutboxRow[] = [];
    while (claimed.length < limit) {
      const wanted = limit - claimed.length;
      const due = await this.#outbox().findMany({
        where: { status: 'pending', nextAttemptAt: { lte: now } },
        orderBy: [{ nextAttemptAt: 'asc' }, { sequence: 'asc' }],
        take: wanted,
      });
      for (const row of due) {
        const taken = await this.#outbox().updateMany({
          where: { id: row.id, status: 'pending', attempts: row.attempts, nextAttemptAt: { lte: now } },
          data: this.#lease(now),
        });
        if (taken.count === 1) {
          claimed.push(row);
        }
      }
      if (due.length < wanted) {
        // Nothing else is due: the rows lost to another relay need no replacement.
        break;
      }
    }
    return claimed;
  }

  /**
   * Selects the due rows `FOR UPDATE SKIP LOCKED`, so concurrent relays pass over each other's
   * rows instead of waiting, then leases them in the same transaction by pushing
   * `nextAttemptAt` forward. It joins the current unit of work or opens a short one of its own:
   * the row locks last a few milliseconds, the lease is what covers the publication.
   */
  #claimSkippingLocked(
    { sql, raw }: { readonly sql: string; readonly raw: (client: Tx) => PrismaRawQueries },
    limit: number,
    now: Date,
  ): Promise<PrismaOutboxRow[]> {
    return this.#unitOfWork.run(async () => {
      const locked: unknown = await raw(this.#unitOfWork.client()).$queryRawUnsafe(sql, 'pending', now, limit);
      const ids = Array.isArray(locked) ? locked.map(idOf) : [];
      if (ids.length === 0) {
        return [];
      }
      const order = new Map(ids.map((id, index) => [id, index]));
      const due = await this.#outbox().findMany({ where: { id: { in: ids } } });
      await this.#outbox().updateMany({ where: { id: { in: ids } }, data: this.#lease(now) });
      // An `in` filter gives no order guarantee: restore the one of the claim.
      return due.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
    });
  }

  #outbox(): PrismaOutboxDelegate {
    return this.#delegate(this.#unitOfWork.client());
  }

  #lease(now: Date): PrismaOutboxUpdate {
    return { attempts: { increment: 1 }, nextAttemptAt: new Date(now.getTime() + this.#leaseMs) };
  }
}

/** The statement Prisma Client cannot express. Identifiers are checked: this is unsafe raw SQL. */
function lockingSelect(claim: {
  readonly dialect: 'postgresql' | 'mysql';
  readonly schema?: string;
  readonly table?: string;
}): string {
  const names = [claim.schema, claim.table ?? 'outbox'].filter((name) => name !== undefined);
  for (const name of names) {
    if (!IDENTIFIER.test(name)) {
      throw new TypeError(`"${name}" is not a plain SQL identifier`);
    }
  }
  const postgres = claim.dialect === 'postgresql';
  const quote = (name: string): string => (postgres ? `"${name}"` : `\`${name}\``);
  const parameter = (position: number): string => (postgres ? `$${position}` : '?');
  return [
    `select ${quote('id')} from ${names.map(quote).join('.')}`,
    `where ${quote('status')} = ${parameter(1)} and ${quote('next_attempt_at')} <= ${parameter(2)}`,
    `order by ${quote('next_attempt_at')}, ${quote('sequence')} limit ${parameter(3)}`,
    'for update skip locked',
  ].join(' ');
}

/**
 * A JSON `null` payload is left out and stored as SQL NULL: Prisma refuses a bare null in a
 * Json field and its sentinels live in the generated client.
 */
function payloadField(payload: unknown): { payload?: PrismaJsonInput } {
  if (payload === null || payload === undefined) {
    return {};
  }
  // eslint-disable-next-line ddd-ts-kit/clean-no-escape-hatch -- the payload of an integration event is JSON by contract and typed `unknown` by the kernel; checking it here would walk every payload a second time
  return { payload: payload as PrismaJsonInput };
}

function idOf(row: unknown): string {
  if (typeof row === 'object' && row !== null && 'id' in row && typeof row.id === 'string') {
    return row.id;
  }
  throw new TypeError('The locking select of the outbox returned a row without an id');
}

function toRecord(row: PrismaOutboxRow): OutboxRecord {
  return {
    event: {
      id: row.id,
      type: row.type,
      version: row.version,
      occurredAt: row.occurredAt,
      payload: row.payload,
      ...(row.traceparent === null ? {} : { traceparent: row.traceparent }),
      ...(row.correlationId === null ? {} : { correlationId: row.correlationId }),
    },
    status: statusOf(row.status),
    attempts: row.attempts,
    nextAttemptAt: row.nextAttemptAt,
    ...(row.lastErrorCode === null ? {} : { lastErrorCode: row.lastErrorCode }),
    ...(row.publishedAt === null ? {} : { publishedAt: row.publishedAt }),
  };
}

function statusOf(status: string): OutboxStatus {
  if (status === 'pending' || status === 'published' || status === 'dead') {
    return status;
  }
  throw new TypeError(`Unknown outbox status "${status}"`);
}
