/** The generated barrel of a declared context, relative to the context: what the composition root imports. */
export function barrelFile(context: string): string {
  return `${context}.declarations.ts`;
}
