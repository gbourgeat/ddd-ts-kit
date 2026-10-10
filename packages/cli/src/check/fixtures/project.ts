import { CONFIG_FILE } from '../../config/index.js';
import { config } from './config.js';
import { contextDoc } from './context-doc.js';
import type { FixtureFiles } from './fixture-files.js';
import { PATHS } from './paths.js';
import { SAMPLES } from './samples.js';

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
