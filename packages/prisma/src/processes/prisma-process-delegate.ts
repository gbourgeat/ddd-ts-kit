import type { PrismaJsonInput } from '../outbox/prisma-json-input';

/**
 * The methods the store calls on the model of the process instances, typed structurally so the
 * package does not depend on your generated client: `client.processInstance` fits as is.
 */
export interface PrismaProcessDelegate {
  createMany(args: { data: PrismaProcessInsert[]; skipDuplicates: true }): Promise<{ count: number }>;
  findFirst(args: { where: PrismaProcessKey }): Promise<PrismaProcessRow | null>;
  updateMany(args: {
    where: PrismaProcessKey & { version: number };
    data: PrismaProcessChange & { updatedAt: Date };
  }): Promise<{ count: number }>;
}

/** An instance by its tenant, the empty text outside any, its process and its correlation key. */
export interface PrismaProcessKey {
  tenantId: string;
  name: string;
  id: string;
}

/** The model of the process instances as Prisma returns it: the fields of the shipped schema fragment. */
export interface PrismaProcessRow {
  /** JSON as text. */
  readonly state: string;
  readonly version: number;
  readonly ended: boolean;
  readonly timeouts: unknown;
}

export interface PrismaProcessChange {
  state: string;
  version: number;
  ended: boolean;
  timeouts: PrismaJsonInput;
}

export type PrismaProcessInsert = PrismaProcessChange & PrismaProcessKey;
