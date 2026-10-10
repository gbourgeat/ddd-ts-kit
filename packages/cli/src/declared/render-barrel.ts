import { declaredRoleOf } from './declared-role-of.js';

/**
 * The barrel of a context: one `export *` per role file, sorted by path, and nothing else. It is
 * derived from the tree, never edited by hand: `ddd-ts-kit check` reports a barrel that differs
 * (`declarations/barrel-current`).
 */
export function renderBarrel(files: readonly string[]): string {
  const roleFiles = [...new Set(files.filter((file) => declaredRoleOf(file) !== undefined))].sort(byPath);

  if (roleFiles.length === 0) {
    return 'export {};\n';
  }

  return `${roleFiles.map((file) => `export * from './${file.replace(/\.ts$/, '.js')}';`).join('\n')}\n`;
}

function byPath(left: string, right: string): number {
  if (left === right) {
    return 0;
  }

  return left < right ? -1 : 1;
}
