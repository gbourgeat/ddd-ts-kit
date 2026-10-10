import { createDataSource } from './create-data-source.js';
import { persistenceOver } from './persistence-over.js';
import type { Persistence } from './persistence.js';

export async function openPersistence(config: { readonly databaseUrl: string }): Promise<Persistence> {
  const dataSource = createDataSource(config.databaseUrl);

  await dataSource.initialize();

  return persistenceOver(dataSource);
}
