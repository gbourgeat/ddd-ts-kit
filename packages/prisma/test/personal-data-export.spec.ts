import { ensureGeneratedClient } from './support/generate';

// The suite needs the generated Prisma client and the DDL of the test schema, which must exist before it is loaded.
await ensureGeneratedClient();
await import('./suites/personal-data-export');
