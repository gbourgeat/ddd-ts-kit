import type { Config } from '../config';
import type { FileMove } from '../file-moves';
import { TEST_FOLDER } from '../model-modules';
import type { Workspace } from '../workspace';

/** The configs of the test runners a project writes by hand once generated, which glob the integration specs of the contexts. */
const RUNNER_CONFIGS = ['vitest.config.ts', 'vitest.mutation.config.ts', 'jest.mutation.config.js'];

/**
 * What to say of each config of a test runner that names the integration specs in the test folder
 * of the contexts alone, once a spec moved to the test folder of a module: an integration spec
 * there would run with the unit specs, without its database. The config is code of the project:
 * it is said, not rewritten.
 */
export function runnerConfigsByHand(ws: Workspace, config: Config, moved: readonly FileMove[]): string[] {
  const integration = `/${TEST_FOLDER}/integration/`;
  const ofContexts = `${config.contextsDir}/`;

  if (!moved.some(({ to }) => to.startsWith(ofContexts) && to.split('/').includes(TEST_FOLDER))) {
    return [];
  }

  return RUNNER_CONFIGS.filter((file) => {
    const text = ws.read(file) ?? '';
    const names = (folders: string): boolean => text.includes(`${ofContexts}${folders}${integration}`);

    // A glob of Vitest, or a pattern of Jest.
    return (names('*') && !names('*/*')) || (names('[^/]+') && !text.includes(`[^/]+/${TEST_FOLDER})/integration/`));
  }).map(
    (file) =>
      `${file} names the integration specs of the test folder of each context alone: name the test folder of its modules beside it (${ofContexts}*/*${integration}), where a module now keeps its own, or they run with the unit specs.`,
  );
}
