import type { SourceFile } from '../model/source-file.js';
import { declaredWith } from './declared-with.js';
import { executorUses, type ExecutorUse } from './executor-uses.js';

/** What confines a read, an update or a delete to the tenant. */
const CONDITION = /(?<![\w$])(?:tenantCondition|ownTenantCondition)\s*\(/;

/** What names the tenant of an inserted row. */
const TENANT_OF_ROW = /(?<![\w$])tenantScopeOf\s*\(/;

const READ_OR_WRITE = /\.(?:select|selectDistinct|from|update|delete)\s*\(/;

/** What a Drizzle adapter of tenant data reaches without the helpers, judged statement by statement. */
export function drizzleUnscoped(file: SourceFile): readonly { offset: number; message: string }[] {
  const { code } = file.scan;

  return executorUses(code).flatMap((use) => {
    const message = use.handedOver ? undefined : unscopedStatement(code, use);

    return message === undefined ? [] : [{ offset: use.offset, message }];
  });
}

function unscopedStatement(code: string, { statement }: ExecutorUse): string | undefined {
  if (/\.query\s*\./.test(statement)) {
    return 'A relational query (executor().query) cannot carry the tenant condition: write it with select().';
  }

  if (/\.execute\s*\(/.test(statement)) {
    return 'Raw SQL (execute) reaches the tables with no tenant condition.';
  }

  if (/\.insert\s*\(/.test(statement)) {
    return TENANT_OF_ROW.test(statement) || declaredWith(code, { statement, method: 'values' }, TENANT_OF_ROW)
      ? undefined
      : 'An insert names no tenant: spread tenantScopeOf(this.scope) into the row it writes.';
  }

  if (READ_OR_WRITE.test(statement)) {
    return CONDITION.test(statement) || declaredWith(code, { statement, method: 'where' }, CONDITION)
      ? undefined
      : 'A statement reaches a table with no tenant condition in its where.';
  }

  return 'The executor is used other than through a statement this rule can judge (held in a variable, a transaction).';
}
