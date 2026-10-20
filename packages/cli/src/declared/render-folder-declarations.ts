import { declaredRoleOf } from './declared-role-of.js';
import { laidOutCalls } from './injection/laid-out-calls.js';
import type { RenderedInjections } from './injection/rendered-injections.js';

const NOTHING: RenderedInjections = { imports: [], calls: [] };

/**
 * The declarations of one role folder: the imports the registrations need, one `export *` per
 * role file of the folder, named by the specifier `specifierOf` gives it and sorted by path, then
 * one `injected(Class, [Tokens])` per class of the folder whose constructor takes something its
 * decorator does not list, read from the constructor signatures. `files` are relative to the
 * context. It is derived from the tree, never edited by hand: `ddd-ts-kit check` reports a file
 * that differs (`declarations/barrel-current`).
 */
export function renderFolderDeclarations(
  files: readonly string[],
  specifierOf: (file: string) => string,
  injected: RenderedInjections = NOTHING,
): string {
  const roleFiles = [...new Set(files.filter((file) => declaredRoleOf(file) !== undefined))].sort();

  if (roleFiles.length === 0) {
    return 'export {};\n';
  }

  const exported = roleFiles.map((file) => `export * from '${specifierOf(file)}';`).join('\n');

  if (injected.calls.length === 0) {
    return `${exported}\n`;
  }

  return `${injected.imports.join('\n')}\n\n${exported}\n\n${laidOutCalls(injected.calls)}\n`;
}
