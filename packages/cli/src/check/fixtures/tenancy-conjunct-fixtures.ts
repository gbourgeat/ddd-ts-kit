import type { Fixture } from './fixture';
import { TENANCY_CONJUNCT_DRIZZLE_FIXTURES } from './tenancy-conjunct-drizzle-fixtures';
import { TENANCY_CONJUNCT_KNEX_FIXTURES } from './tenancy-conjunct-knex-fixtures';
import { TENANCY_CONJUNCT_PRISMA_FIXTURES } from './tenancy-conjunct-prisma-fixtures';
import { TENANCY_CONJUNCT_TYPEORM_FIXTURES } from './tenancy-conjunct-typeorm-fixtures';

/** The tenant condition holds for every row a statement reaches: an alternative groups beside it, on each ORM. */
export const TENANCY_CONJUNCT_FIXTURES: readonly Fixture[] = [
  ...TENANCY_CONJUNCT_KNEX_FIXTURES,
  ...TENANCY_CONJUNCT_DRIZZLE_FIXTURES,
  ...TENANCY_CONJUNCT_PRISMA_FIXTURES,
  ...TENANCY_CONJUNCT_TYPEORM_FIXTURES,
];
