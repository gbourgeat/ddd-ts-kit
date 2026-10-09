import { ensureGeneratedClient } from './support/generate.js';

// The suite imports the generated Prisma client, which must exist before it is loaded.
await ensureGeneratedClient();
await import('./suites/repository.js');
