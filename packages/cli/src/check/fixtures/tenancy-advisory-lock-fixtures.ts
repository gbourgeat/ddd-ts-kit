import type { Fixture } from './fixture';
import { project } from './project';
import { TENANCY_ADAPTERS } from './tenancy-adapters';
import { tenancyBypass } from './tenancy-bypass';
import { tenancyConfig } from './tenancy-config';

type Orm = keyof typeof TENANCY_ADAPTERS;

const IMPORTED: Readonly<Record<Orm, string>> = {
  knex: '@ddd-ts-kit/knex',
  drizzle: '@ddd-ts-kit/drizzle/postgres',
  prisma: '@ddd-ts-kit/prisma',
  typeorm: '@ddd-ts-kit/typeorm',
};

/** A lock by hand on each ORM: raw SQL, which the rule reports with the name of the helper. */
export const ADVISORY_LOCKS_BY_HAND: Readonly<Record<Orm, string>> = {
  knex: "await this.database.executor().raw('select pg_advisory_xact_lock(hashtext(?))', [key]);",
  drizzle: 'await this.database.executor().execute(sql`select pg_advisory_xact_lock(hashtext(${key}))`);',
  prisma: 'await this.database.client().$executeRaw`select pg_try_advisory_xact_lock(hashtext(${key}))`;',
  typeorm: "await this.database.manager().query('select pg_advisory_lock(hashtext($1))', [key]);",
};

const ORMS: readonly Orm[] = ['knex', 'drizzle', 'prisma', 'typeorm'];

/** The lock on a business key: accepted through `advisoryLock` and `tryAdvisoryLock`, reported as a raw statement. */
export const ADVISORY_LOCK_FIXTURES: readonly Fixture[] = ORMS.flatMap((orm) => [
  throughTheHelper(orm),
  tenancyBypass(orm, 'an advisory lock taken by a raw statement', ADVISORY_LOCKS_BY_HAND[orm]),
]);

function throughTheHelper(orm: Orm): Fixture {
  const { file, owner } = TENANCY_ADAPTERS[orm];

  const source = `import { advisoryLock, tryAdvisoryLock } from '${IMPORTED[orm]}';

export class ${owner} {
  async nextNumber(): Promise<void> {
    await advisoryLock(this.database, 'invoice-number', { tenant: this.scope });
  }

  alone(): Promise<boolean> {
    return tryAdvisoryLock(this.database, 'invoice-closing', { tenant: this.scope });
  }
}
`;

  return {
    ruleId: 'tenancy/scoped-statement',
    name: `${orm}: an advisory lock taken through the helper of the package`,
    expect: 'pass',
    files: project({ [file]: source }, tenancyConfig(orm)),
  };
}
