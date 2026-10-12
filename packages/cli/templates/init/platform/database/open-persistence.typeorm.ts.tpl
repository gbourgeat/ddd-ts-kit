import { createDataSource } from '{{alias.platform}}/database/create-data-source{{alias.ext}}';
import { persistenceOver } from '{{alias.platform}}/database/persistence-over{{alias.ext}}';
import type { Persistence } from '{{alias.platform}}/database/persistence{{alias.ext}}';

export async function openPersistence(config: { readonly databaseUrl: string }): Promise<Persistence> {
  const dataSource = createDataSource(config.databaseUrl);

  await dataSource.initialize();

  return persistenceOver(dataSource);
}
