import { connectToDatabase } from './connect-to-database.js';
import { persistenceOver } from './persistence-over.js';
import type { Persistence } from './persistence.js';

export function openPersistence(config: { readonly databaseUrl: string }): Persistence {
  const connection = connectToDatabase(config.databaseUrl);

  return persistenceOver(connection.db, () => connection.close());
}
