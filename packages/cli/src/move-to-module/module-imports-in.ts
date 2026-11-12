import { type ModuleImport, moduleImports } from '../check/modules/module-imports';
import { isSource } from '../check/project/is-source';
import { loadSourceFile } from '../check/project/load-source-file';
import type { Config } from '../config';
import { filesUnder } from '../generate/files-under';
import type { Workspace } from '../workspace';

/**
 * The imports between the modules of one context as the workspace holds it, on disk or planned:
 * read as `ddd-ts-kit check` reads them, so that a command judges a move as `module/no-cycle` will.
 */
export function moduleImportsIn(ws: Workspace, config: Config, context: string): ModuleImport[] {
  const directory = `${config.contextsDir}/${context}`;

  const sources = filesUnder(ws, directory)
    .map((file) => `${directory}/${file}`)
    .filter(isSource)
    .map((file) => loadSourceFile(config, file, ws.read(file) ?? ''));

  return moduleImports(sources);
}
