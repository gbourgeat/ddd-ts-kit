import { TEST_FOLDER } from '../../model-modules';
import type { Project } from '../model/project';

/** Where the tests of a file of a context go: the folder, from the project root with its closing slash, and whether it is of the module alone. */
export interface TestFolder {
  readonly directory: string;
  readonly ofModule: boolean;
}

/**
 * The test folder a file of a context is tested in: the one of its module of the model once that
 * module holds its tests (`<module>/test/`), the one of the context otherwise, where the specs of
 * a module sit in the folder named after it (`test/unit/<module>/`).
 */
export function testFolderOf(project: Project, context: string, module: string | undefined): TestFolder {
  const ofContext = `${project.config.contextsDir}/${context}/`;
  const ofModule = `${ofContext}${module ?? ''}/${TEST_FOLDER}/`;

  return module !== undefined && project.contextEntries.some((entry) => entry.startsWith(ofModule))
    ? { directory: ofModule, ofModule: true }
    : { directory: `${ofContext}${TEST_FOLDER}/`, ofModule: false };
}
