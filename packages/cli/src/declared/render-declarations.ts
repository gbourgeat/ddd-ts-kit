import { moduleSplit } from '../model-modules';
import { barrelFile } from './barrel-file';
import { declaredRoleOf } from './declared-role-of';
import { type DeclarationsGrouping, declarationsFolderOf } from './declarations-folder-of';
import { folderDeclarationsFile } from './folder-declarations-file';
import type { RenderedInjections } from './injection/rendered-injections';
import { renderFolderDeclarations } from './render-folder-declarations';

/** What the declarations of a context are rendered from; every file is relative to the context. */
export interface DeclarationsSource {
  readonly context: string;
  readonly files: readonly string[];
  /** The modules of the model the context declares. */
  readonly modules: readonly string[];
  /** One declarations file per layer, the default, or per role folder. */
  readonly grouping?: DeclarationsGrouping;
  /** How a generated import names a file of the context: its alias, ending as the project writes its imports. */
  readonly specifierOf: (file: string) => string;
  /** The registrations of what the classes of these role files are given, all of one declarations file. */
  readonly injectedIn: (roleFiles: readonly string[]) => RenderedInjections;
}

/**
 * Every generated declarations file of a context assembled by barrel, by path relative to the
 * context: one per layer that holds a role file, in each module of the model
 * (`folderDeclarationsFile`), then the summary
 * at the root, `<context>.declarations.ts`, which only re-exports them, sorted by path. Nested
 * `export *` flatten: the namespace the composition root imports holds every declared class.
 */
export function renderDeclarations({
  context,
  files,
  modules,
  grouping = 'layer',
  specifierOf,
  injectedIn,
}: DeclarationsSource): Map<string, string> {
  const byFolder = new Map<string, string[]>();
  const roleFiles = [...new Set(files)].filter((candidate) => declaredRoleOf(candidate, modules) !== undefined);

  for (const file of roleFiles.sort()) {
    const folder = folderDeclarationsFile(
      declarationsFolderOf(file, modules, grouping),
      grouping === 'layer' ? moduleSplit(file, modules).path.split('/')[0] : undefined,
    );

    byFolder.set(folder, [...(byFolder.get(folder) ?? []), file]);
  }

  const rendered = new Map<string, string>();

  for (const [folderFile, roleFiles] of [...byFolder].sort(([left], [right]) => byPath(left, right))) {
    rendered.set(folderFile, renderFolderDeclarations(roleFiles, { specifierOf, modules }, injectedIn(roleFiles)));
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
