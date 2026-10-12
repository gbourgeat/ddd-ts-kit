import type { Finding } from '../model/finding.js';
import type { Rule } from '../model/rule.js';
import type { SourceFile } from '../model/source-file.js';
import { inLayers } from '../support/in-layers.js';
import { perFile } from '../support/per-file.js';

/** A Knex table reached straight from the executor: `executor()('invoices')`, `executor()<Row, Row[]>('invoices')`. */
const KNEX_TABLE = /\.executor\s*\(\s*\)\s*(?:<[^()]*>)?\s*\(/g;

/** A Drizzle statement on a table: `.from(table)`, `.update(table)`, `.delete(table)`. */
const DRIZZLE_STATEMENT = /\.(?:from|update|delete)\s*\(/g;

/** What confines a Drizzle statement to the tenant: the condition of a read, of a write, or the tenant of an insert. */
const DRIZZLE_TENANT = /(?<![\w$.])(?:tenantCondition|ownTenantCondition)\s*\(/;

const FIX =
  'Reach tenant data through the helpers of the ORM package: `tenantTable` to read and `ownTenantTable` to write (Knex), `tenantCondition` and `ownTenantCondition` in the condition (Drizzle). A table that holds no tenant data is a deviation: `// ddd-ts-kit-disable-next-line tenancy/scoped-statement -- ADR-NNNN: <why>`.';

export const tenancyScopedStatement: Rule = {
  id: 'tenancy/scoped-statement',
  description:
    'In a multi-tenant project ("stack.tenancy" other than "none"), a persistence adapter of a context confines every statement to the tenant of the work through the helpers of its ORM package, never a table reached straight from the executor.',
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

function unscoped(file: SourceFile, orm: string): Finding[] {
  if (orm === 'knex') {
    return matches(file, KNEX_TABLE, 'A table is reached straight from executor(), with no tenant condition.');
  }

  if (orm !== 'drizzle' || DRIZZLE_TENANT.test(file.scan.code) || !file.scan.code.includes('.executor(')) {
    return [];
  }

  return matches(
    file,
    DRIZZLE_STATEMENT,
    'A statement reaches a table, and no tenant condition is written in this adapter.',
  );
}

function matches(file: SourceFile, pattern: RegExp, message: string): Finding[] {
  return [...file.scan.code.matchAll(pattern)].map((match) => ({
    line: file.scan.lineAt(match.index),
    message,
    fix: FIX,
  }));
}
