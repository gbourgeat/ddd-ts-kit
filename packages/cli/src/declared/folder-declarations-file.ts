import path from 'node:path';

/**
 * The generated declarations of a role folder (`declarationsFolderOf`), relative to the context:
 * the file named after the folder, inside it, `application/commands/commands.declarations.ts`. It
 * exports the role files of the folder and registers what their constructors are injected.
 */
export function folderDeclarationsFile(folder: string): string {
  return `${folder}/${path.posix.basename(folder)}.declarations.ts`;
}
