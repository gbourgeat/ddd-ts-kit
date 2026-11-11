import { aliasRoots } from '../alias';
import type { Config } from '../config';
import { heldFileOf, placedImports, treeOf } from '../model-modules';
import type { Workspace } from '../workspace';

/**
 * A wiring rendered from a template, which names each file of a context as it is written without
 * modules, with every import naming the file where the context holds it: in a module of its model
 * or in `shared/`. `init --force` wires the contexts again without the placement of the generators.
 */
export function withHeldImports(ws: Workspace, config: Config, wiring: string): string {
  const contexts = `${config.contextsDir}/`;

  return placedImports(wiring, aliasRoots(config), (file) => {
    const [context = '', ...inside] = file.startsWith(contexts) ? file.slice(contexts.length).split('/') : [];

    return inside.length > 1 ? heldFileOf(ws, treeOf(config, context), inside.join('/')) : file;
  });
}
