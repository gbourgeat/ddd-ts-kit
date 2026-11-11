import type { Workspace } from '../workspace';
import type { ContextTree } from './context-tree';
import { SHARED_FOLDER, TEST_FOLDER } from './module-layers';

/**
 * True when a context divided into modules is laid out with its tests in its modules: it holds
 * `shared/`, or one of its modules holds a test folder. A new spec, fake or builder of a module
 * then goes to `<module>/test/`, of a module that has none yet too.
 */
export function holdsModuleTests(ws: Workspace, { directory, modules }: ContextTree): boolean {
  return (
    modules.length > 0 &&
    [SHARED_FOLDER, ...modules.map((module) => `${module}/${TEST_FOLDER}`)].some((folder) =>
      ws.existsAsIs(`${directory}/${folder}`),
    )
  );
}
