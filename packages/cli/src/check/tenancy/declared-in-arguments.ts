import { balancedArguments } from './balanced-arguments';
import { declarationOf } from './declaration-of';

/**
 * The names an arguments text uses as values: a local, a shorthand property (`{ where }`), the
 * argument of a spread; never a property key (`data:`), a call (`tenantWhere(`) or a member
 * (`this.scope`, `state.id`).
 */
const NAMES = /(?<![\w$.])([A-Za-z_$][\w$]*)(?![\w$]|\s*[:(.])/g;

/** A call in a statement, found by a pattern that ends on its opening parenthesis, and where the statement is in the source. */
export interface ArgumentsCall {
  readonly statement: string;
  readonly call: RegExp;
  readonly at: number;
}

/**
 * Whether the arguments of the call name a local declared with what `pattern` finds:
 * `createMany({ data: [row] })` after `const row = { ...state, ...tenantScopeOf(this.scope) };`,
 * or `findMany({ where })` after `const where = tenantWhere(this.scope);`.
 */
export function declaredInArguments(code: string, { statement, call, at }: ArgumentsCall, pattern: RegExp): boolean {
  const found = call.exec(statement);

  if (found === null) {
    return false;
  }

  const open = found.index + found[0].length - 1;

  return [...balancedArguments(statement, open).matchAll(NAMES)].some(([, name]) => {
    const declaration = name === undefined ? undefined : declarationOf(code, name, at);

    return declaration !== undefined && pattern.test(declaration);
  });
}
