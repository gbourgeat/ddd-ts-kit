import { connectToDatabase } from '{{alias.platform}}/database/connect-to-database{{alias.ext}}';
import { persistenceOver } from '{{alias.platform}}/database/persistence-over{{alias.ext}}';
import type { Persistence } from '{{alias.platform}}/database/persistence{{alias.ext}}';

export function openPersistence(config: { readonly databaseUrl: string }): Persistence {
  return persistenceOver(connectToDatabase(config.databaseUrl));
}
