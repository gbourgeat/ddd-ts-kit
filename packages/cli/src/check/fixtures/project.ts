import { CONFIG_FILE } from '../../config';
import { config } from './config';
import { contextDoc } from './context-doc';
import type { FixtureFiles } from './fixture-files';
import { PATHS } from './paths';
import { SAMPLES } from './samples';

/** Two declared contexts, billing downstream of catalog, each with a valid CONTEXT.md. */
export function project(files: FixtureFiles, overrides: FixtureFiles = {}): FixtureFiles {
  return {
    [CONFIG_FILE]: config(),
    [PATHS.FIXTURE_ADR]: SAMPLES.RECORD,
    [`${PATHS.BILLING}/CONTEXT.md`]: contextDoc('core'),
    [`${PATHS.CATALOG}/CONTEXT.md`]: contextDoc('supporting'),
    ...files,
    ...overrides,
  };
}
