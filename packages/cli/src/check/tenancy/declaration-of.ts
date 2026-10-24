/**
 * What a local is declared with (`const mine = ...;`) in the last declaration before `at`, which
 * is the one a statement at `at` sees when several methods name a local alike, or `undefined`
 * when the file declares no such local before it.
 */
export function declarationOf(code: string, name: string, at: number): string | undefined {
  const declarations = new RegExp(`(?:const|let)\\s+${name.replaceAll('$', '\\$')}\\s*=([^;]*)`, 'g');
  const before = [...code.matchAll(declarations)].filter((match) => match.index < at);

  return before.at(-1)?.[1];
}
