import type { OrmStack } from '../../../config';
import type { Name } from '../../../naming';
import { toName } from '../../../naming';
import { REPOSITORY_ADAPTERS } from '../repository-adapter';

/** The port, the adapter, the fake and the spec of the erasure of one context, named after it and after the ORM. */
export interface PersonalNames {
  readonly port: string;
  readonly portKebab: string;
  readonly adapter: string;
  readonly adapterKebab: string;
  readonly fake: string;
  /** The class the adapter extends, with the type argument the storage of the project asks for. */
  readonly base: string;
}

/** What the adapter of each ORM extends: the erasure of its package, over the context class of the generated platform. */
const BASES: Readonly<Record<string, string>> = {
  knex: 'KnexPersonalDataErasure',
  drizzle: 'DrizzlePersonalDataErasure<PgQueryResultHKT>',
  prisma: 'PrismaPersonalDataErasure<Prisma.TransactionClient>',
  typeorm: 'TypeOrmPersonalDataErasure',
};

export function personalNames(orm: OrmStack, context: Name): PersonalNames {
  const prefix = REPOSITORY_ADAPTERS[orm].prefix;
  const erasure: Name = toName(`${context.pascal}PersonalDataErasure`);
  const adapter: Name = toName(`${prefix}${erasure.pascal}`);

  return {
    port: erasure.pascal,
    portKebab: erasure.kebab,
    adapter: adapter.pascal,
    adapterKebab: adapter.kebab,
    fake: `Fake${erasure.pascal}`,
    base: BASES[orm] ?? prefix,
  };
}
