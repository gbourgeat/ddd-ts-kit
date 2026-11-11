import type { Workspace } from '../workspace';
import type { ContextTree } from './context-tree';
import { holdsModuleTests } from './holds-module-tests';
import { intoModule } from './into-module';
import { TEST_FOLDER } from './module-layers';

/**
 * Where the tests of a module of the model go, from the project root, for a folder of the tests
 * (`unit`, `integration`): in the test folder of the module (`<module>/test/unit`) once the
 * context keeps its tests in its modules (`holdsModuleTests`), else in the folder of the context
 * named after it (`test/unit/<module>`). Without a module, the folder of the context.
 */
export function moduleTestFolderOf(
  ws: Workspace,
  tree: ContextTree,
  { module, folder }: { readonly module: string | undefined; readonly folder: string },
): string {
  return module !== undefined && holdsModuleTests(ws, tree)
    ? `${tree.directory}/${module}/${TEST_FOLDER}/${folder}`
    : `${tree.directory}/${intoModule(module, `${TEST_FOLDER}/${folder}`)}`;
}
