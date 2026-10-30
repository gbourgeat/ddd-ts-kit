import type { AccessorUse } from './accessor-uses';
import { balancedArguments } from './balanced-arguments';
import { declaredInArguments } from './declared-in-arguments';
import { spreadsAtTop } from './spreads-at-top';

/** What a statement on the client or the manager has to carry: the method that found it, and the helper its where must spread. */
export interface WhereGuard {
  readonly method: string;
  readonly pattern: RegExp;
  /** What to say when the statement names the helper nowhere. */
  readonly absent: string;
}

const NOT_AT_TOP =
  'The tenant condition is no conjunct of the statement: spread the helper at the top of its where, never under OR, NOT, a relation or one entry of a where array.';

/** What is wrong with the where of a Prisma or TypeORM statement, or `undefined` when it holds the tenant for every row. */
export function unconfinedWhere(code: string, use: AccessorUse, guard: WhereGuard): string | undefined {
  const { statement, offset: at } = use;
  const call = new RegExp(`\\.${guard.method}\\s*\\(`);
  const found = call.exec(statement);
  const argumentsText = found === null ? '' : balancedArguments(statement, found.index + found[0].length - 1);

  if (spreadsAtTop(argumentsText, { code, at, helper: guard.pattern })) {
    return undefined;
  }

  return guard.pattern.test(statement) || declaredInArguments(code, { statement, call, at }, guard.pattern)
    ? NOT_AT_TOP
    : guard.absent;
}
