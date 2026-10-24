import type { QueuedJobStatus } from '@ddd-ts-kit/kernel';
import type { PrismaJsonInput } from '../outbox/prisma-json-input';

/**
 * The methods the store calls on the model of the background jobs, typed structurally so the
 * package does not depend on your generated client: `client.backgroundJob` fits as is.
 */
export interface PrismaJobDelegate {
  createMany(args: { data: PrismaJobInsert[]; skipDuplicates: true }): Promise<{ count: number }>;
  findFirst(args: { where: PrismaJobWhere }): Promise<PrismaJobRow | null>;
  findMany(args: { where: PrismaJobWhere }): Promise<PrismaJobRow[]>;
  updateMany(args: { where: PrismaJobWhere; data: PrismaJobUpdate }): Promise<{ count: number }>;
  deleteMany(args: { where: PrismaJobWhere }): Promise<{ count: number }>;
  count(args: { where: PrismaJobWhere }): Promise<number>;
}

/** The model of the background jobs as Prisma returns it: the fields of the shipped schema fragment. */
export interface PrismaJobRow {
  readonly id: string;
  readonly name: string;
  readonly queue: string;
  readonly payload: unknown;
  readonly enqueuedBy: unknown;
  /** The empty text for a job enqueued outside any tenant. */
  readonly tenantId: string;
  readonly subject: string | null;
  readonly status: string;
  readonly attempts: number;
  readonly runAt: Date;
  readonly leaseUntil: Date | null;
  readonly progress: unknown;
  /** JSON as text. */
  readonly checkpoint: string | null;
  readonly lastErrorCode: string | null;
  readonly enqueuedAt: Date;
  readonly finishedAt: Date | null;
}

export interface PrismaJobInsert {
  id: string;
  name: string;
  queue: string;
  payload?: PrismaJsonInput;
  enqueuedBy: PrismaJsonInput;
  idempotencyKey: string | null;
  tenantId: string;
  subject: string | null;
  runAt: Date;
  enqueuedAt: Date;
}

export interface PrismaJobWhere {
  id?: string | { in: string[] };
  name?: string;
  queue?: string;
  tenantId?: string;
  idempotencyKey?: string;
  status?: QueuedJobStatus | { in: QueuedJobStatus[] };
  attempts?: number;
  finishedAt?: { lt: Date };
}

export interface PrismaJobUpdate {
  status?: QueuedJobStatus;
  attempts?: number | { increment: number } | { decrement: number };
  runAt?: Date;
  leaseUntil?: Date | null;
  finishedAt?: Date | null;
  progress?: PrismaJsonInput;
  checkpoint?: string | null;
  lastErrorCode?: string;
}
