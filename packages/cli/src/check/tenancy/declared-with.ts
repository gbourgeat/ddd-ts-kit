/** A call of a statement whose argument may be a local: `.where(mine)` in `.select().from(invoices).where(mine)`. */
export interface StatementCall {
  readonly statement: string;
  readonly method: string;
}

/**
 * Whether the argument of `.<method>(<name>)` in a statement is a local declared with what
 * `pattern` finds: `.where(mine)` after `const mine = and(eq(...), tenantCondition(...));`.
 */
export function declaredWith(code: string, { statement, method }: StatementCall, pattern: RegExp): boolean {
  const argument = new RegExp(`\\.${method}\\s*\\(\\s*([A-Za-z_$][\\w$]*)\\s*\\)`).exec(statement)?.[1];

  if (argument === undefined) {
    return false;
  }

  const declaration = new RegExp(`(?:const|let)\\s+${argument.replaceAll('$', '\\$')}\\s*=([^;]*)`).exec(code);

  return declaration?.[1] !== undefined && pattern.test(declaration[1]);
}
