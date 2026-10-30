/** What a local is declared with, and where. */
export interface Declaration {
  readonly text: string;
  readonly at: number;
}

/**
 * The last declaration of a local before `at` (`const mine = ...;`, `const mine: Row = ...;`), which
 * is the one a statement at `at` sees when several methods name a local alike, or `undefined`
 * when the file declares no such local before it.
 */
export function declarationBefore(code: string, name: string, at: number): Declaration | undefined {
  const declarations = new RegExp(`(?:const|let)\\s+${name.replaceAll('$', '\\$')}\\s*(?::[^=;]*)?=([^;]*)`, 'g');
  const last = [...code.matchAll(declarations)].filter((match) => match.index < at).at(-1);

  return last === undefined ? undefined : { text: last[1] ?? '', at: last.index };
}
