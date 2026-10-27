import { isControlPlane, type Config } from '../../config';
import type { Finding } from '../model/finding';
import type { Rule } from '../model/rule';
import type { SourceFile } from '../model/source-file';
import { inLayers } from '../support/in-layers';
import { perFile } from '../support/per-file';
import { drizzleUnscoped } from '../tenancy/drizzle-unscoped';
import { knexUnscoped } from '../tenancy/knex-unscoped';
import { prismaUnscoped } from '../tenancy/prisma-unscoped';
import { typeormUnscoped } from '../tenancy/typeorm-unscoped';
import { unscopedReadModels } from '../tenancy/unscoped-read-models';

const FIX =
  'Reach tenant data through the helpers of the ORM package: `tenantTable` to read and `ownTenantTable` to write (Knex), `tenantCondition` and `ownTenantCondition` in the where of each statement and `tenantScopeOf` in each inserted row (Drizzle), `tenantWhere` and `ownTenantWhere` spread into the where of each statement and `tenantScopeOf` into each created row (Prisma, TypeORM), the `tenant` option of a read model store. A context whose tables belong to no tenant (the control plane of the tenants) is declared so, `"contexts.<name>.tenancy": "control-plane"` recorded in "deviations"; one table that holds no tenant data is a deviation: `// ddd-ts-kit-disable-next-line tenancy/scoped-statement -- ADR-NNNN: <why>`.';

const READ_MODEL = 'A read model store is built without the `tenant` option: its rows are shared by every tenant.';

export const tenancyScopedStatement: Rule = {
  id: 'tenancy/scoped-statement',
  description:
    'In a multi-tenant project ("stack.tenancy" other than "none"), a persistence adapter of a context that is not the control plane of the tenants confines every statement to the tenant of the work through the helpers of its ORM package: never the executor, client or manager used straight, raw SQL, a relational query, a row reached by its key alone, or a read model store without its tenant.',
  scope: 'file',
  run(project) {
    const { tenancy, orm } = project.config.stack;

    if (tenancy === 'none') {
      return [];
    }

    return perFile(project, this.id, (file) => (isAdapter(file, project.config) ? unscoped(file, orm) : []));
  },
};

/** The persistence code of a context that holds tenant data: its infrastructure, tests and fakes left out. */
function isAdapter(file: SourceFile, config: Config): boolean {
  const location = file.isTest ? undefined : inLayers(file, ['infrastructure']);

  return location !== undefined && !isControlPlane(config, location.context);
}

const STATEMENTS: Readonly<Record<string, (file: SourceFile) => readonly { offset: number; message: string }[]>> = {
  knex: knexUnscoped,
  drizzle: drizzleUnscoped,
  prisma: prismaUnscoped,
  typeorm: typeormUnscoped,
};

function unscoped(file: SourceFile, orm: string): Finding[] {
  const statements = STATEMENTS[orm]?.(file) ?? [];
  const readModels = unscopedReadModels(file).map((offset) => ({ offset, message: READ_MODEL }));

  return [...statements, ...readModels].map(({ offset, message }) => ({
    line: file.scan.lineAt(offset),
    message,
    fix: FIX,
  }));
}
