import type { OrmStack } from '../../config/index.js';
import type { Name } from '../../naming/index.js';
import type { Output } from '../emit.js';

/** The adapter each ORM of the stack gets: its class prefix and the files written next to the port. */
export interface RepositoryAdapter {
  readonly prefix: string;
  readonly files: (aggregate: Name) => Output[];
}

export const REPOSITORY_ADAPTERS: Readonly<Record<OrmStack, RepositoryAdapter>> = {
  none: { prefix: 'InMemory', files: inMemoryAdapter },
  custom: { prefix: 'InMemory', files: inMemoryAdapter },
  drizzle: { prefix: 'Drizzle', files: ormAdapter('drizzle', 'drizzle') },
  knex: { prefix: 'Knex', files: ormAdapter('knex', 'knex', ['row']) },
  prisma: { prefix: 'Prisma', files: ormAdapter('prisma', 'prisma') },
  typeorm: { prefix: 'TypeOrm', files: ormAdapter('typeorm', 'type-orm', ['row']) },
};

function inMemoryAdapter(aggregate: Name): Output[] {
  return [['repository/none/repository.ts.tpl', persistence(`in-memory-${aggregate.kebab}.repository`)]];
}

/** The mapper and the adapter every ORM writes, then the files of its own. */
function ormAdapter(orm: string, prefix: string, extra: readonly string[] = []): RepositoryAdapter['files'] {
  return (aggregate) => [
    [`repository/${orm}/mapper.ts.tpl`, persistence(`${aggregate.kebab}.mapper`)],
    ...extra.map(
      (file): Output => [`repository/${orm}/${file}.ts.tpl`, persistence(`${aggregate.kebab}-${file}.schema`)],
    ),
    [`repository/${orm}/repository.ts.tpl`, persistence(`${prefix}-${aggregate.kebab}.repository`)],
  ];
}

function persistence(file: string): string {
  return `infrastructure/persistence/${file}.ts`;
}
