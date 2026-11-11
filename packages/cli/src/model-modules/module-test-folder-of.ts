import type { Workspace } from '../workspace';
import type { ContextTree } from './context-tree';
import { intoModule } from './into-module';
import { TEST_FOLDER } from './module-layers';

/**
 * Where the tests of a module of the model go, from the project root, for a folder of the tests
 * (`unit`, `integration`): in the test folder of the module once it holds one
 * (`<module>/test/unit`), else in the folder of the context named after it (`test/unit/<module>`).
 * Without a module, the folder of the context.
 */
export function moduleTestFolderOf(
  ws: Workspace,
  { directory }: ContextTree,
  { module, folder }: { readonly module: string | undefined; readonly folder: string },
): string {
  const ofModule = `${directory}/${module ?? ''}/${TEST_FOLDER}`;

  return module !== undefined && ws.existsAsIs(ofModule)
    ? `${ofModule}/${folder}`
    : `${directory}/${intoModule(module, `${TEST_FOLDER}/${folder}`)}`;
}
