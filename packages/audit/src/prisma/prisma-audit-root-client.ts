import type { PrismaAuditClient } from './prisma-audit-client';

/** The client outside any transaction: the one that opens them. */
export interface PrismaAuditRootClient extends PrismaAuditClient {
  $transaction<R>(work: (transaction: PrismaAuditClient) => Promise<R>): Promise<R>;
}
