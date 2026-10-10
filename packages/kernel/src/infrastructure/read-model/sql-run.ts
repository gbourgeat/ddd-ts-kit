/**
 * Runs one statement on the executor of the current unit of work and answers its rows.
 * Parameters are written `$1`, `$2`, each once and in order, so an adapter whose driver wants
 * `?` only has to replace them.
 */
export type SqlRun = (
  statement: string,
  parameters: readonly (string | number)[],
) => Promise<readonly Readonly<Record<string, unknown>>[]>;
