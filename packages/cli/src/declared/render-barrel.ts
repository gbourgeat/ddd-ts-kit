import { declaredRoleOf } from './declared-role-of.js';
import { laidOutCalls } from './injection/laid-out-calls.js';
import type { RenderedInjections } from './injection/rendered-injections.js';

const NOTHING: RenderedInjections = { imports: [], calls: [] };

/**
 * The barrel of a context: one `export *` per role file, named by the specifier `specifierOf`
 * gives it (its alias, ending as the project writes its imports) and sorted by path; then,
 * when a constructor of the context takes something its decorator does not list, the imports
 * and the `injected(Class, [Tokens])` statements read from the constructor signatures.
 * `files` are relative to the context. It is derived from the tree, never edited by hand:
 * `ddd-ts-kit check` reports a barrel that differs (`declarations/barrel-current`).
 */
export function renderBarrel(
  files: readonly string[],
  specifierOf: (file: string) => string,
  injected: RenderedInjections = NOTHING,
): string {
  const roleFiles = [...new Set(files.filter((file) => declaredRoleOf(file) !== undefined))].sort(byPath);

  if (roleFiles.length === 0) {
    return 'export {};\n';
  }

  const exported = roleFiles.map((file) => `export * from '${specifierOf(file)}';`).join('\n');

  if (injected.calls.length === 0) {
    return `${exported}\n`;
  }

  return `${injected.imports.join('\n')}\n\n${exported}\n\n${laidOutCalls(injected.calls)}\n`;
}

function byPath(left: string, right: string): number {
  if (left === right) {
    return 0;
  }

  return left < right ? -1 : 1;
}
