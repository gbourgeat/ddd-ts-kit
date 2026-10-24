import type { SourceFile } from '../model/source-file';
import { accessorUses, type AccessorUse } from './accessor-uses';
import { declaredInArguments } from './declared-in-arguments';
import { declaredWith } from './declared-with';

/** What confines a read to the tenants of the work. */
const CONDITION = /(?<![\w$])(?:tenantWhere|ownTenantWhere)\s*\(/;

/** What confines an update or a delete to the one tenant of the work. */
const OWN_CONDITION = /(?<![\w$])ownTenantWhere\s*\(/;

/** What names the tenant of an inserted row. */
const TENANT_OF_ROW = /(?<![\w$])tenantScopeOf\s*\(/;

const RAW = /\.query\s*\(/;
const BY_KEY = /\.(save|upsert)\s*\(/;
const WRITE = /\.(update|delete|softDelete|restore|increment|decrement)\s*\(/;
const INSERT = /\.insert\s*\(/;
const BUILDER = /\.createQueryBuilder\s*\(/;

const READ =
  /\.(find|findBy|findOne|findOneBy|findOneOrFail|findOneByOrFail|findAndCount|findAndCountBy|count|countBy|exists|existsBy|sum|average|minimum|maximum)\s*\(/;

/** The one helper that takes the manager and writes a row: the row it is given has to name the tenant. */
const HANDED_TO_INSERT = /insertIgnoringConflict\s*\(\s*[\w$.]*$/;
const INSERT_IGNORING_CONFLICT = /insertIgnoringConflict\s*\(/;

const UNJUDGED =
  'The manager is used other than through a statement this rule can judge (held in a variable, a transaction).';

/** What a statement on the manager has to carry: the method that found it, and the helper its arguments must name. */
interface Guard {
  readonly method: string;
  readonly pattern: RegExp;
}

/** What a TypeORM adapter of tenant data reaches without the helpers, judged statement by statement on the manager. */
export function typeormUnscoped(file: SourceFile): readonly { offset: number; message: string }[] {
  const { code } = file.scan;

  return accessorUses(code, 'manager').flatMap((use) => {
    const message = use.handedOver ? handedOver(code, use) : unscopedStatement(code, use);

    return message === undefined ? [] : [{ offset: use.offset, message }];
  });
}

/** The manager handed to `insertIgnoringConflict`: the row must name its tenant. Another helper confines it itself. */
function handedOver(code: string, { before, statement, offset }: AccessorUse): string | undefined {
  if (!HANDED_TO_INSERT.test(before)) {
    return undefined;
  }

  const whole = { statement: `${before}.manager()${statement}`, call: INSERT_IGNORING_CONFLICT, at: offset };

  return TENANT_OF_ROW.test(whole.statement) || declaredInArguments(code, whole, TENANT_OF_ROW)
    ? undefined
    : 'An insert names no tenant: spread tenantScopeOf(this.scope) into the row it writes.';
}

function unscopedStatement(code: string, use: AccessorUse): string | undefined {
  const { statement } = use;

  if (RAW.test(statement)) {
    return 'Raw SQL (query) reaches the tables with no tenant condition.';
  }

  const byKey = BY_KEY.exec(statement)?.[1];

  if (byKey !== undefined) {
    return `${byKey} writes a row by its key alone, and the tenant is never part of the key: insert with insertIgnoringConflict and update with ownTenantWhere in the criteria.`;
  }

  return BUILDER.test(statement) ? unconfinedBuilder(code, use) : unconfinedStatement(code, use);
}

function unconfinedStatement(code: string, use: AccessorUse): string | undefined {
  const { statement } = use;
  const write = WRITE.exec(statement)?.[1];

  if (write !== undefined) {
    return confined(code, use, { method: write, pattern: OWN_CONDITION })
      ? undefined
      : 'A write names no tenant: spread ownTenantWhere(this.scope) into its criteria.';
  }

  if (INSERT.test(statement)) {
    return insertNamesTenant(code, use)
      ? undefined
      : 'An insert names no tenant: spread tenantScopeOf(this.scope) into the row it writes.';
  }

  const read = READ.exec(statement)?.[1];

  if (read !== undefined) {
    return confined(code, use, { method: read, pattern: CONDITION })
      ? undefined
      : 'A read reaches the entity with no tenant condition: spread tenantWhere(this.scope) into its where.';
  }

  return UNJUDGED;
}

/**
 * A query builder: an insert names the tenant in the row it is given, a delete or an update
 * carries the own condition in its where, a select the condition of a read, inline or in the
 * local the where is given.
 */
function unconfinedBuilder(code: string, use: AccessorUse): string | undefined {
  const { statement, offset } = use;

  if (/\.insert\s*\(\s*\)/.test(statement)) {
    return insertNamesTenant(code, use)
      ? undefined
      : 'An insert names no tenant: spread tenantScopeOf(this.scope) into the row it writes.';
  }

  const writes = /\.(?:delete|update)\s*\(/.test(statement);
  const pattern = writes ? OWN_CONDITION : CONDITION;

  const inWhere = ['where', 'andWhere'].some((method) =>
    declaredWith(code, { statement, method, at: offset }, pattern),
  );

  if (pattern.test(statement) || inWhere) {
    return undefined;
  }

  return writes
    ? 'A write names no tenant: spread ownTenantWhere(this.scope) into its where.'
    : 'A query builder reaches the table with no tenant condition in its where.';
}

/** `manager.insert(entity, row)` or `createQueryBuilder().insert().into(entity).values(row)`: the row names the tenant. */
function insertNamesTenant(code: string, { statement, offset }: AccessorUse): boolean {
  return (
    TENANT_OF_ROW.test(statement) ||
    declaredInArguments(code, { statement, call: INSERT, at: offset }, TENANT_OF_ROW) ||
    declaredWith(code, { statement, method: 'values', at: offset }, TENANT_OF_ROW)
  );
}

/** The helper is written in the statement, or in a local the arguments of the call name. */
function confined(code: string, { statement, offset }: AccessorUse, { method, pattern }: Guard): boolean {
  const call = new RegExp(`\\.${method}\\s*\\(`);

  return pattern.test(statement) || declaredInArguments(code, { statement, call, at: offset }, pattern);
}
