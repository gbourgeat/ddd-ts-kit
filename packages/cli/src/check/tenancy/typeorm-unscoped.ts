import type { SourceFile } from '../model/source-file';
import { accessorUses, type AccessorUse } from './accessor-uses';
import { chainLinks } from './chain-links';
import { declaredInArguments } from './declared-in-arguments';
import { declaredWith } from './declared-with';
import { isOrLink } from './is-or-link';
import { spreadsAtTop } from './spreads-at-top';
import { unconfinedWhere } from './unconfined-where';

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

const NOT_A_CONJUNCT =
  'The tenant condition is no conjunct of the statement: spread the helper into the last where of the query builder (a later where resets it) or an andWhere after it, and group alternatives beside it in `new Brackets(...)`, never in an orWhere at its top.';

const UNJUDGED =
  'The manager is used other than through a statement this rule can judge (held in a variable, a transaction).';

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
    return unconfinedWhere(code, use, {
      method: write,
      pattern: OWN_CONDITION,
      absent: 'A write names no tenant: spread ownTenantWhere(this.scope) into its criteria.',
    });
  }

  if (INSERT.test(statement)) {
    return insertNamesTenant(code, use)
      ? undefined
      : 'An insert names no tenant: spread tenantScopeOf(this.scope) into the row it writes.';
  }

  const read = READ.exec(statement)?.[1];

  if (read !== undefined) {
    return unconfinedWhere(code, use, {
      method: read,
      pattern: CONDITION,
      absent: 'A read reaches the entity with no tenant condition: spread tenantWhere(this.scope) into its where.',
    });
  }

  return UNJUDGED;
}

/**
 * A query builder: an insert names the tenant in the row it is given, a delete or an update
 * carries the own condition in its where, a select the condition of a read, spread at the top of
 * the last where or an andWhere after it, since a where resets what comes before it, inline or
 * in the local it is given, and no orWhere stands beside them.
 */
function unconfinedBuilder(code: string, use: AccessorUse): string | undefined {
  const { statement, offset: at } = use;

  if (/\.insert\s*\(\s*\)/.test(statement)) {
    return insertNamesTenant(code, use)
      ? undefined
      : 'An insert names no tenant: spread tenantScopeOf(this.scope) into the row it writes.';
  }

  const writes = /\.(?:delete|update)\s*\(/.test(statement);
  const pattern = writes ? OWN_CONDITION : CONDITION;
  const links = chainLinks(statement, 0);
  const reading = { code, at, helper: pattern };

  const conjunct = links
    .slice(
      Math.max(
        links.findLastIndex(({ method }) => method === 'where'),
        0,
      ),
    )
    .filter(({ method }) => method === 'where' || method === 'andWhere')
    .some(({ argumentsText }) => spreadsAtTop(argumentsText, reading));

  if (conjunct && !links.some(isOrLink)) {
    return undefined;
  }

  if (
    pattern.test(statement) ||
    ['where', 'andWhere'].some((method) => declaredWith(code, { statement, method, at }, pattern))
  ) {
    return NOT_A_CONJUNCT;
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
