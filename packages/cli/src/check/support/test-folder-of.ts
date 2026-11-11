import { TEST_FOLDER } from '../../model-modules';
import type { Project } from '../model/project';

/** Where the tests of a file of a context go: the folder, from the project root with its closing slash. */
export interface TestFolder {
  readonly directory: string;
}

/**
 * The test folder a file of a context is tested in: the one of its module of the model
 * (`<module>/test/`), or the one of the context when it is in no module.
 */
export function testFolderOf(project: Project, context: string, module: string | undefined): TestFolder {
  const ofContext = `${project.config.contextsDir}/${context}/`;

  return module === undefined
    ? { directory: `${ofContext}${TEST_FOLDER}/` }
    : { directory: `${ofContext}${module}/${TEST_FOLDER}/` };
}
