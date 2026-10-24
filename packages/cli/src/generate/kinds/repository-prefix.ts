import type { OrmStack } from '../../config';
import type { RenderContext } from '../../templating';
import { REPOSITORY_ADAPTERS } from './repository-adapter';

/** How the adapter of a repository is named on an ORM (`Knex`, `knex`), and whether it is built over the database. */
export function repositoryPrefix(orm: OrmStack): RenderContext {
  const { prefix } = REPOSITORY_ADAPTERS[orm];

  return {
    pascal: prefix,
    kebab: prefix.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase(),
    needsDatabase: prefix !== 'InMemory',
  };
}
