/** The routes a context exposes, relative to the context: the one list the composition root mounts. */
export function routesFile(context: string): string {
  return `presentation/http/${context}.routes.ts`;
}
