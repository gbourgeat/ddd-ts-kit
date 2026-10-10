import { connectToDatabase } from '{{alias.platform}}/database/connect-to-database.js';
import { persistenceOver } from '{{alias.platform}}/database/persistence-over.js';
import type { Persistence } from '{{alias.platform}}/database/persistence.js';

export function openPersistence(config: { readonly databaseUrl: string }): Persistence {
  const connection = connectToDatabase(config.databaseUrl);

  return persistenceOver(connection.db, () => connection.close());
}
