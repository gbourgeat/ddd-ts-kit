import { barrelFile } from './barrel-file.js';
import { declaredRoleOf } from './declared-role-of.js';
import { declarationsFolderOf } from './declarations-folder-of.js';
import { folderDeclarationsFile } from './folder-declarations-file.js';
import type { RenderedInjections } from './injection/rendered-injections.js';
import { renderFolderDeclarations } from './render-folder-declarations.js';

/** What the declarations of a context are rendered from; every file is relative to the context. */
export interface DeclarationsSource {
  readonly context: string;
  readonly files: readonly string[];
  /** How a generated import names a file of the context: its alias, ending as the project writes its imports. */
  readonly specifierOf: (file: string) => string;
  /** The registrations of what the classes of these role files are given, all of one folder. */
  readonly injectedIn: (roleFiles: readonly string[]) => RenderedInjections;
}

/**
 * Every generated declarations file of a context assembled by barrel, by path relative to the
 * context: one per role folder that holds a role file (`folderDeclarationsFile`), then the summary
 * at the root, `<context>.declarations.ts`, which only re-exports them, sorted by path. Nested
 * `export *` flatten: the namespace the composition root imports holds every declared class.
 */
export function renderDeclarations({
  context,
  files,
  specifierOf,
  injectedIn,
}: DeclarationsSource): Map<string, string> {
  const byFolder = new Map<string, string[]>();

  for (const file of [...new Set(files)].filter((candidate) => declaredRoleOf(candidate) !== undefined).sort()) {
    const folder = folderDeclarationsFile(declarationsFolderOf(file));

    byFolder.set(folder, [...(byFolder.get(folder) ?? []), file]);
  }

  const rendered = new Map<string, string>();

  for (const [folderFile, roleFiles] of [...byFolder].sort(([left], [right]) => byPath(left, right))) {
    rendered.set(folderFile, renderFolderDeclarations(roleFiles, specifierOf, injectedIn(roleFiles)));
  }

  rendered.set(barrelFile(context), summaryOf([...rendered.keys()], specifierOf));

  return rendered;
}

function summaryOf(folderFiles: readonly string[], specifierOf: (file: string) => string): string {
  if (folderFiles.length === 0) {
    return 'export {};\n';
  }

  return `${folderFiles.map((file) => `export * from '${specifierOf(file)}';`).join('\n')}\n`;
}

function byPath(left: string, right: string): number {
  if (left === right) {
    return 0;
  }

  return left < right ? -1 : 1;
}
