import { ensureAuditPrismaClient } from './support/prisma/generate';

// The suite needs the generated Prisma client and the DDL of the models, which must exist before it is loaded.
await ensureAuditPrismaClient();
await import('./suites/prisma');
