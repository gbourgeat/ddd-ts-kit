import { CONFIG_FILE } from '../../config';
import { config } from './config';
import type { FixtureFiles } from './fixture-files';
import { project } from './project';

/** The declared style assembled by discovery: the role files are found at startup, no barrel lists them. */
export function discoveredProject(files: FixtureFiles, overrides: FixtureFiles = {}): FixtureFiles {
  return project(files, {
    [CONFIG_FILE]: config({ stack: { style: 'declared', assembly: 'discovery' } }),
    ...overrides,
  });
}
