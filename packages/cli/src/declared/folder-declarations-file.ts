import path from 'node:path';

/**
 * The generated declarations of a folder (`declarationsFolderOf`), relative to the context: the
 * file inside it named after the layer, `application/application.declarations.ts`, the same in a
 * module of the model, or, grouped by role folder as 0.85 and 0.86 wrote them, named after the
 * folder, `application/commands/commands.declarations.ts`. It exports the role files of the folder
 * and registers what their constructors are injected. `layer` is the layer of the folder.
 */
export function folderDeclarationsFile(folder: string, layer?: string): string {
  return `${folder}/${layer ?? path.posix.basename(folder)}.declarations.ts`;
}
