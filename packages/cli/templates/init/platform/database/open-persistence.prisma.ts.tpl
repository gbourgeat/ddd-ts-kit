import { createClient } from '{{alias.platform}}/database/create-client{{alias.ext}}';
import { persistenceOver } from '{{alias.platform}}/database/persistence-over{{alias.ext}}';
import type { Persistence } from '{{alias.platform}}/database/persistence{{alias.ext}}';

export async function openPersistence(config: { readonly databaseUrl: string }): Promise<Persistence> {
  const client = createClient(config.databaseUrl);

  await client.$connect();

  return persistenceOver(client);
}
