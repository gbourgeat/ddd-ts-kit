/**
 * The generated summary of a declared context, relative to the context: what the composition
 * root imports. It re-exports the declarations file of each role folder (`folderDeclarationsFile`).
 */
export function barrelFile(context: string): string {
  return `${context}.declarations.ts`;
}
