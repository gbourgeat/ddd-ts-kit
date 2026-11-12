import { posix } from 'node:path';
import { type ModuleImport, moduleImports } from '../check/modules/module-imports';
import { isSource } from '../check/project/is-source';
import { loadSourceFile } from '../check/project/load-source-file';
import { notInTheTree } from '../check/project/not-in-the-tree';
import type { Config } from '../config';
import { filesUnder } from '../generate/files-under';
import type { Workspace } from '../workspace';

/**
 * The imports between the modules of one context as the workspace holds it, on disk or planned:
 * the files `ddd-ts-kit check` reads (`notInTheTree`), read as it reads them, so that a command
 * judges a move as `module/no-cycle` will. An import that names a folder is told by the `index.ts`
 * it reaches, the file a person can open.
 */
export function moduleImportsIn(ws: Workspace, config: Config, context: string): ModuleImport[] {
  const directory = `${config.contextsDir}/${context}`;
  const left = notInTheTree(ws.root, config);

  const sources = filesUnder(ws, directory)
    .map((file) => `${directory}/${file}`)
    .filter(
      (file) => isSource(file) && !left(file, false) && foldersTo(file, directory).every((one) => !left(one, true)),
    )
    .map((file) => loadSourceFile(config, file, ws.read(file) ?? ''));

  return moduleImports(sources).map((one) => ({ ...one, imported: fileReached(ws, one.imported) }));
}

/** The folders that hold a file, below `directory`. */
function foldersTo(file: string, directory: string): string[] {
  const folder = posix.dirname(file);

  return folder === directory ? [] : [...foldersTo(folder, directory), folder];
}

/** The file an import reaches: the one it names, or the `index.ts` of the folder it names. */
function fileReached(ws: Workspace, imported: string): string {
  const index = `${imported.replace(/\.ts$/, '')}/index.ts`;

  return !ws.exists(imported) && ws.exists(index) ? index : imported;
}
