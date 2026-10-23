import { aliasRoots } from '../alias';
import type { Config } from '../config';
import { contextFilePlacement } from '../context-files';
import { placedImports } from '../model-modules';
import type { Workspace } from '../workspace';

/**
 * Reads and writes the code list and the permission set of each context where the project holds
 * them, at the root or where 0.86 and 0.87 wrote them, the imports written following: what `init --force`
 * needs to wire again the contexts of a project that has not moved yet.
 */
export function placeContextFiles(ws: Workspace, config: Config): void {
  const place = contextFilePlacement(config.contextsDir, (file) => ws.existsAsIs(file));

  ws.placeFiles((file) => place(file));
  ws.rewriteImports((_file, text) => placedImports(text, aliasRoots(config), place));
}
