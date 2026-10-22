import type { Workspace } from '../workspace/index.js';
import type { RegressionSpec } from './regression-spec.js';
import { scenariosIn } from './scenarios-in.js';

/** Each listed spec with its tests, read as the scenarios of an acceptance are; a missing file has none. */
export function readRegression(ws: Workspace, files: readonly string[]): RegressionSpec[] {
  return files.map((file) => {
    const text = ws.read(file);

    if (text === undefined) {
      return { file, found: false, tests: [] };
    }

    return {
      file,
      found: true,
      tests: scenariosIn(text).map(({ title, line, state, fingerprint }) => ({ title, line, state, fingerprint })),
    };
  });
}
