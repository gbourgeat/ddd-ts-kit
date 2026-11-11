import type { ContextTree } from './context-tree';
import { intoModule } from './into-module';
import { TEST_FOLDER } from './module-layers';

/**
 * Where the tests of a module of the model go, from the project root, for a folder of the tests
 * (`unit`, `integration`): the test folder of the module (`<module>/test/unit`). Without a
 * module, the folder of the context.
 */
export function moduleTestFolderOf({ directory }: ContextTree, module: string | undefined, folder: string): string {
  return `${directory}/${intoModule(module, `${TEST_FOLDER}/${folder}`)}`;
}
