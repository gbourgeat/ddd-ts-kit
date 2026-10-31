import type { AppConfig } from '{{alias.platform}}/config/app-config{{alias.ext}}';
import { createClient } from '{{alias.platform}}/database/create-client{{alias.ext}}';
import { persistenceOver } from '{{alias.platform}}/database/persistence-over{{alias.ext}}';
import type { Persistence } from '{{alias.platform}}/database/persistence{{alias.ext}}';

export async function openPersistence(
  config: Pick<AppConfig, 'databaseUrl' | 'databaseTransaction'>,
): Promise<Persistence> {
  const client = createClient(config.databaseUrl);

  await client.$connect();

  return persistenceOver(client, config.databaseTransaction);
}
