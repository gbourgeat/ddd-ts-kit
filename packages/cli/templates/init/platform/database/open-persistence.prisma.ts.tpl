import { createClient } from './create-client.js';
import { persistenceOver } from './persistence-over.js';
import type { Persistence } from './persistence.js';

export async function openPersistence(config: { readonly databaseUrl: string }): Promise<Persistence> {
  const client = createClient(config.databaseUrl);

  await client.$connect();

  return persistenceOver(client);
}
