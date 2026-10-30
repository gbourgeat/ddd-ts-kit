import type { SourceFile } from '../model/source-file';
import { declaredWith } from './declared-with';
import type { AccessorUse } from './accessor-uses';
import { chainLinks } from './chain-links';
import { executorUses } from './executor-uses';
import { isConjunct } from './is-conjunct';

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

function unscopedStatement(code: string, { statement, offset }: AccessorUse): string | undefined {
  if (/\.query\s*\./.test(statement)) {
    return 'A relational query (executor().query) cannot carry the tenant condition: write it with select().';
  }

  if (/\.execute\s*\(/.test(statement)) {
    return 'Raw SQL (execute) reaches the tables with no tenant condition.';
  }

  if (/\.insert\s*\(/.test(statement)) {
    return TENANT_OF_ROW.test(statement) ||
      declaredWith(code, { statement, method: 'values', at: offset }, TENANT_OF_ROW)
      ? undefined
      : 'An insert names no tenant: spread tenantScopeOf(this.scope) into the row it writes.';
  }

  if (READ_OR_WRITE.test(statement)) {
    return unconfinedStatement(code, statement, offset);
  }

  return 'The executor is used other than through a statement this rule can judge (held in a variable, a transaction).';
}

/** The where holds the condition for every row, or says what is wrong with it. */
function unconfinedStatement(code: string, statement: string, at: number): string | undefined {
  const reading = { code, at, helper: CONDITION };

  const conjunct = chainLinks(statement, 0)
    .filter(({ method }) => method === 'where')
    .some(({ argumentsText }) => isConjunct(argumentsText, reading));

  if (conjunct) {
    return undefined;
  }

  return CONDITION.test(statement) || declaredWith(code, { statement, method: 'where', at }, CONDITION)
    ? 'The tenant condition is no conjunct of the statement: make it a direct argument of its where or of a top-level and, never under or, not or a sql template.'
    : 'A statement reaches a table with no tenant condition in its where.';
}
