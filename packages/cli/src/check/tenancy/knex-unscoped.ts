import type { SourceFile } from '../model/source-file';
import { executorUses } from './executor-uses';
import { knexOrOnTenantBuilder } from './knex-or-on-tenant-builder';
import { rawReachesRows } from './raw-reaches-rows';
import { rawSqlText } from './raw-sql-text';

/** Raw SQL, which no helper confines. */
const RAW = /\.raw\s*\(/g;

/** A raw use of the executor: judged by what its SQL says, as any raw SQL. */
const RAW_STATEMENT = /^\s*\.raw\s*\(/;

const OR_ON_BUILDER =
  'at the top of a statement of a tenant helper is outside its tenant condition: group the alternatives beside it, `.where((either) => either.where(a).orWhere(b))`.';

/**
 * What a Knex adapter of tenant data reaches without the helpers: the executor called, chained or
 * held, and raw SQL. A raw call whose first argument is a literal that reaches no row by itself
 * (an aggregate in a select, a constraint of the schema: `rawReachesRows`) is not reported, since
 * the statement it is put in is what the tenant confines; any other raw call is. An `or` at the
 * top of a statement of the helpers leaves the tenant condition behind (`knexOrOnTenantBuilder`).
 */
export function knexUnscoped(file: SourceFile): readonly { offset: number; message: string }[] {
  const { code } = file.scan;

  const straight = executorUses(code)
    .filter((use) => !use.handedOver && !RAW_STATEMENT.test(use.statement))
    .map((use) => ({
      offset: use.offset,
      message: 'The executor is used straight (called, chained or held): no tenant condition confines it.',
    }));

  const raw = [...code.matchAll(RAW)]
    .filter((match) => reachesRows(file, match.index + match[0].length))
    .map((match) => ({ offset: match.index, message: 'Raw SQL reaches the tables with no tenant condition.' }));

  const alternatives = knexOrOnTenantBuilder(code).map(({ offset, method }) => ({
    offset,
    message: `\`${method}\` ${OR_ON_BUILDER}`,
  }));

  return [...straight, ...raw, ...alternatives];
}

/** True unless the first argument is a literal whose SQL reaches no row by itself. */
function reachesRows(file: SourceFile, argumentsStart: number): boolean {
  const text = rawSqlText(file, argumentsStart);

  return text === undefined || rawReachesRows(text);
}
