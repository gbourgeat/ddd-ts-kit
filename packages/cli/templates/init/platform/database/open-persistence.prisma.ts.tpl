import { createClient } from '{{alias.platform}}/database/create-client.js';
import { persistenceOver } from '{{alias.platform}}/database/persistence-over.js';
import type { Persistence } from '{{alias.platform}}/database/persistence.js';

export async function openPersistence(config: { readonly databaseUrl: string }): Promise<Persistence> {
  const client = createClient(config.databaseUrl);

  await client.$connect();

  return persistenceOver(client);
}
