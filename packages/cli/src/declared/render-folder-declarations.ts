import { declaredRoleOf } from './declared-role-of';
import { laidOutCalls } from './injection/laid-out-calls';
import type { RenderedInjections } from './injection/rendered-injections';

const NOTHING: RenderedInjections = { imports: [], calls: [] };

/**
 * The declarations of one role folder: the imports the registrations need, one `export *` per
 * role file of the folder, named by the specifier `specifierOf` gives it and sorted by path, then
 * one `injected(Class, [Tokens])` per class of the folder whose constructor takes something its
 * decorator does not list, read from the constructor signatures. `files` are relative to the
 * context, `modules` are the modules of the model it declares. It is derived from the tree, never edited by hand: `ddd-ts-kit check` reports a file
 * that differs (`declarations/barrel-current`).
 */
/** How the declarations name a role file, and the modules of the model the files may sit in. */
export interface FolderNaming {
  readonly specifierOf: (file: string) => string;
  readonly modules: readonly string[];
}

export function renderFolderDeclarations(
  files: readonly string[],
  { specifierOf, modules }: FolderNaming,
  injected: RenderedInjections = NOTHING,
): string {
  const roleFiles = [...new Set(files.filter((file) => declaredRoleOf(file, modules) !== undefined))].sort();

  if (roleFiles.length === 0) {
    return 'export {};\n';
  }

  const exported = roleFiles.map((file) => `export * from '${specifierOf(file)}';`).join('\n');

  if (injected.calls.length === 0) {
    return `${exported}\n`;
  }

  return `${injected.imports.join('\n')}\n\n${exported}\n\n${laidOutCalls(injected.calls)}\n`;
}
