/** What the guards of the kit document on the routes behind them. */
const GUARD_ERRORS: Readonly<Record<string, readonly string[]>> = {
  Authenticated: ['UNAUTHORIZED'],
  HasRole: ['UNAUTHORIZED', 'FORBIDDEN'],
};

/** The codes the guards before a route answer, besides those it declares: `HasRole('admin')` answers 401 and 403. */
export function guardErrors(guards: readonly string[]): string[] {
  return guards.flatMap((guard) => GUARD_ERRORS[guard.replace(/\(.*$/, '')] ?? []);
}
