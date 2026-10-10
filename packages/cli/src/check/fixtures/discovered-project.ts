import { CONFIG_FILE } from '../../config/index.js';
import { config } from './config.js';
import type { FixtureFiles } from './fixture-files.js';
import { project } from './project.js';

/** The declared style assembled by discovery: the role files are found at startup, no barrel lists them. */
export function discoveredProject(files: FixtureFiles, overrides: FixtureFiles = {}): FixtureFiles {
  return project(files, { [CONFIG_FILE]: config({ stack: { style: 'declared', assembly: 'discovery' } }), ...overrides });
}
