import { ensureGeneratedClient } from './generate';

// The check of the test types reads the generated client before any spec has run to generate it.
await ensureGeneratedClient();
