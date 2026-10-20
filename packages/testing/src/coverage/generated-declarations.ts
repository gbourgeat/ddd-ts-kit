/**
 * The declarations the generator writes in the role folders of a declared context
 * (`application/commands/commands.declarations.ts`): derived from the tree and held by
 * `declarations/barrel-current`, never measured, since a spec of an adapter does not load them.
 */
export function generatedDeclarations(contextsDir: string): string {
  return `${contextsDir}/**/*.declarations.ts`;
}
