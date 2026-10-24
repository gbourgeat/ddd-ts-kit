import type { PrismaAuditClient } from './prisma-audit-client';

/** The `PrismaContext` of `@ddd-ts-kit/prisma`, restated structurally: any unit of work of that package fits. */
export interface PrismaAuditContext {
  /** The transaction client of the unit of work in progress, the root client otherwise. */
  client(): PrismaAuditClient;
  inTransaction(): boolean;
}
