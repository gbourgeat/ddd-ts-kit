/**
 * The declarations the generator writes in the layers of a declared context
 * (`application/application.declarations.ts`): derived from the tree and held by
 * `declarations/barrel-current`, never measured, since a spec of an adapter does not load them.
 */
export function generatedDeclarations(contextsDir: string): string {
  return `${contextsDir}/**/*.declarations.ts`;
}
