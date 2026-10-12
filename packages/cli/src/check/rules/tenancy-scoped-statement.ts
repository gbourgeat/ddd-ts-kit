import type { Finding } from '../model/finding.js';
import type { Rule } from '../model/rule.js';
import type { SourceFile } from '../model/source-file.js';
import { inLayers } from '../support/in-layers.js';
import { perFile } from '../support/per-file.js';
import { drizzleUnscoped } from '../tenancy/drizzle-unscoped.js';
import { knexUnscoped } from '../tenancy/knex-unscoped.js';
import { unscopedReadModels } from '../tenancy/unscoped-read-models.js';

const FIX =
  'Reach tenant data through the helpers of the ORM package: `tenantTable` to read and `ownTenantTable` to write (Knex), `tenantCondition` and `ownTenantCondition` in the where of each statement and `tenantScopeOf` in each inserted row (Drizzle), the `tenant` option of a read model store. A table that holds no tenant data is a deviation: `// ddd-ts-kit-disable-next-line tenancy/scoped-statement -- ADR-NNNN: <why>`.';

const READ_MODEL = 'A read model store is built without the `tenant` option: its rows are shared by every tenant.';

export const tenancyScopedStatement: Rule = {
  id: 'tenancy/scoped-statement',
  description:
    'In a multi-tenant project ("stack.tenancy" other than "none"), a persistence adapter of a context confines every statement to the tenant of the work through the helpers of its ORM package: never the executor used straight, raw SQL, a relational query, or a read model store without its tenant.',
  scope: 'file',
  run(project) {
    const { tenancy, orm } = project.config.stack;

    if (tenancy === 'none') {
      return [];
    }

    return perFile(project, this.id, (file) => (isAdapter(file) ? unscoped(file, orm) : []));
  },
};

/** The persistence code of a context: its infrastructure, tests and fakes left out. */
function isAdapter(file: SourceFile): boolean {
  return !file.isTest && inLayers(file, ['infrastructure']) !== undefined;
}

const STATEMENTS: Readonly<Record<string, (file: SourceFile) => readonly { offset: number; message: string }[]>> = {
  knex: knexUnscoped,
  drizzle: drizzleUnscoped,
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
