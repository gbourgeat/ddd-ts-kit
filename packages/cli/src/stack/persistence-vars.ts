import type { Config } from '../config';
import type { RenderContext } from '../templating';
import { WITH_DATABASE } from './with-database';

interface StorageToken {
  readonly token: string;
  readonly from: string;
}

/** What a repository adapter names in its dependency list to reach the storage: a class of the platform, or the context class of the ORM package. */
const STORAGE_TOKEN: Readonly<Record<string, StorageToken>> = {
  drizzle: { token: 'Database', from: '' },
  prisma: { token: 'Database', from: '' },
  knex: { token: 'KnexContext', from: '@ddd-ts-kit/knex' },
  typeorm: { token: 'TypeOrmContext', from: '@ddd-ts-kit/typeorm' },
};

/** How the composition roots open the storage of the stack, and what the storage offers them. */
export function persistenceVars(config: Config): RenderContext {
  const { orm, events } = config.stack;
  const hasDatabase = WITH_DATABASE.includes(orm);

  return {
    needsUrl: hasDatabase,
    hasDatabase,
    ...tokenVars(STORAGE_TOKEN[orm]),
    await: orm === 'typeorm' || orm === 'prisma' ? 'await ' : '',
    signals: !hasDatabase && events === 'outbox',
  };
}

function tokenVars(storage: StorageToken | undefined): RenderContext {
  const token = storage?.token ?? '';
  const from = storage?.from ?? '';

  return {
    ownDatabase: token !== '' && from === '',
    packagedToken: from !== '',
    token,
    tokenOrNone: token === '' ? 'Database' : token,
    tokenPackage: from,
  };
}
