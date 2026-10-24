import type { OutboxStatus } from '@ddd-ts-kit/events';
import type { PrismaJsonInput } from './prisma-json-input';

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

/** The outbox model as Prisma returns it: the fields of the shipped schema fragment. */
export interface PrismaOutboxRow {
  readonly id: string;
  readonly type: string;
  readonly version: number;
  readonly occurredAt: string;
  readonly payload: unknown;
  readonly traceparent: string | null;
  readonly correlationId: string | null;
  /** Absent from a model without the field. */
  readonly tenantId?: string | null;
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
  /** Written by a store told `tenant: true`, to a model that has the field. */
  tenantId?: string | null;
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
