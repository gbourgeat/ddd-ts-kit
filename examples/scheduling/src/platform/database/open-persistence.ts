import { connectToDatabase } from '@/platform/database/connect-to-database';
import { persistenceOver } from '@/platform/database/persistence-over';
import type { Persistence } from '@/platform/database/persistence';

export function openPersistence(config: { readonly databaseUrl: string }): Persistence {
  return persistenceOver(connectToDatabase(config.databaseUrl));
}
