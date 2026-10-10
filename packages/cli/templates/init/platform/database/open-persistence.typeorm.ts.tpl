import { createDataSource } from '{{alias.platform}}/database/create-data-source.js';
import { persistenceOver } from '{{alias.platform}}/database/persistence-over.js';
import type { Persistence } from '{{alias.platform}}/database/persistence.js';

export async function openPersistence(config: { readonly databaseUrl: string }): Promise<Persistence> {
  const dataSource = createDataSource(config.databaseUrl);

  await dataSource.initialize();

  return persistenceOver(dataSource);
}
