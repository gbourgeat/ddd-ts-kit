import type { IntegrationEvent } from '@ddd-ts-kit/kernel';
import type { OutboxRecord, OutboxStats, OutboxStore } from '@ddd-ts-kit/events';
import type { PrismaUnitOfWork } from '../unit-of-work/create-prisma-unit-of-work';
import { lockedIdOf } from './locked-id-of';
import { lockingSelect } from './locking-select';
import { payloadField } from './payload-field';
import type { PrismaOutboxClaim } from './prisma-outbox-claim';
import type { PrismaOutboxDelegate, PrismaOutboxRow, PrismaOutboxUpdate } from './prisma-outbox-delegate';
import type { PrismaRawQueries } from './prisma-raw-queries';
import { toOutboxRecord } from './to-outbox-record';

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
  /**
   * Writes the tenant of each event to `tenantId`, which the model of a multi-tenant project
   * has (`tenantId String? @map("tenant_id")`): its consumers then run in that tenant. Default
   * false, for a model without the field. A model that has it is read back either way.
   */
  readonly tenant?: boolean;
}

interface LockingClaim<Tx> {
  readonly sql: string;
  readonly raw: (client: Tx) => PrismaRawQueries;
}

// A fresh record is due at once, whatever clock the relay runs on.
const DUE_IMMEDIATELY = new Date(0);

/**
 * The outbox through Prisma Client. `append` runs on the client of the unit of work: called
 * inside `run`, the events are written by the transaction of the command and share its fate,
 * which is the whole point of an outbox.
 */
export class PrismaOutboxStore<Tx> implements OutboxStore {
  private readonly unitOfWork: PrismaUnitOfWork<Tx>;

  private readonly modelOf: (client: Tx) => PrismaOutboxDelegate;

  /** Absent when claiming by compare-and-set. */
  private readonly lockingClaim: LockingClaim<Tx> | undefined;

  private readonly leaseDurationMs: number;

  private readonly tenant: boolean;

  constructor(unitOfWork: PrismaUnitOfWork<Tx>, options: PrismaOutboxStoreOptions<Tx>) {
    this.unitOfWork = unitOfWork;
    this.modelOf = options.delegate;

    this.lockingClaim =
      options.claim === 'compare-and-set' ? undefined : { sql: lockingSelect(options.claim), raw: options.claim.raw };

    this.leaseDurationMs = options.leaseMs ?? 30_000;
    this.tenant = options.tenant ?? false;
  }

  async append(events: readonly IntegrationEvent[]): Promise<void> {
    if (events.length === 0) {
      return;
    }

    await this.outbox().createMany({
      data: events.map((event) => ({
        id: event.id,
        type: event.type,
        version: event.version,
        occurredAt: event.occurredAt,
        ...payloadField(event.payload),
        traceparent: event.traceparent ?? null,
        correlationId: event.correlationId ?? null,
        ...(this.tenant ? { tenantId: event.tenantId ?? null } : {}),
        nextAttemptAt: DUE_IMMEDIATELY,
      })),
    });
  }

  async claimBatch(limit: number, now: Date): Promise<OutboxRecord[]> {
    if (limit <= 0) {
      return [];
    }

    const claimed =
      this.lockingClaim === undefined
        ? await this.claimByCompareAndSet(limit, now)
        : await this.claimSkippingLocked(this.lockingClaim, limit, now);

    const leasedUntil = new Date(now.getTime() + this.leaseDurationMs);

    return claimed.map((row) => toOutboxRecord({ ...row, attempts: row.attempts + 1, nextAttemptAt: leasedUntil }));
  }

  async markPublished(ids: readonly string[], at: Date): Promise<void> {
    if (ids.length === 0) {
      return;
    }

    await this.outbox().updateMany({
      where: { id: { in: [...ids] } },
      data: { status: 'published', publishedAt: at },
    });
  }

  async markFailed(id: string, error: { readonly code: string }, nextAttemptAt: Date | null): Promise<void> {
    await this.outbox().updateMany({
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

    const revived = await this.outbox().updateMany({
      where: { id: { in: [...ids] }, status: 'dead' },
      data: { status: 'pending', attempts: 0, nextAttemptAt: now },
    });

    return revived.count;
  }

  async purgePublished(before: Date): Promise<number> {
    const purged = await this.outbox().deleteMany({
      where: { status: 'published', publishedAt: { lt: before } },
    });

    return purged.count;
  }

  async stats(): Promise<OutboxStats> {
    const outbox = this.outbox();
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
  private async claimByCompareAndSet(limit: number, now: Date): Promise<PrismaOutboxRow[]> {
    const claimed: PrismaOutboxRow[] = [];

    while (claimed.length < limit) {
      const wanted = limit - claimed.length;

      const due = await this.outbox().findMany({
        where: { status: 'pending', nextAttemptAt: { lte: now } },
        orderBy: [{ nextAttemptAt: 'asc' }, { sequence: 'asc' }],
        take: wanted,
      });

      for (const row of due) {
        const taken = await this.outbox().updateMany({
          where: { id: row.id, status: 'pending', attempts: row.attempts, nextAttemptAt: { lte: now } },
          data: this.lease(now),
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
  private claimSkippingLocked({ sql, raw }: LockingClaim<Tx>, limit: number, now: Date): Promise<PrismaOutboxRow[]> {
    return this.unitOfWork.run(async () => {
      const locked: unknown = await raw(this.unitOfWork.client()).$queryRawUnsafe(sql, 'pending', now, limit);
      const ids = Array.isArray(locked) ? locked.map(lockedIdOf) : [];

      if (ids.length === 0) {
        return [];
      }

      const order = new Map(ids.map((id, index) => [id, index]));
      const due = await this.outbox().findMany({ where: { id: { in: ids } } });

      await this.outbox().updateMany({ where: { id: { in: ids } }, data: this.lease(now) });

      // An `in` filter gives no order guarantee: restore the one of the claim.
      return due.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
    });
  }

  private outbox(): PrismaOutboxDelegate {
    return this.modelOf(this.unitOfWork.client());
  }

  private lease(now: Date): PrismaOutboxUpdate {
    return { attempts: { increment: 1 }, nextAttemptAt: new Date(now.getTime() + this.leaseDurationMs) };
  }
}
