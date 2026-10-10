import { CONFIG_FILE } from '../../config/index.js';
import { barrelFile, renderBarrel } from '../../declared/index.js';
import { config } from './config.js';
import type { FixtureFiles } from './fixture-files.js';
import { project } from './project.js';

/** The same two contexts in the declared style, each with the barrel of the role files it is given. */
export function declaredProject(files: FixtureFiles, overrides: FixtureFiles = {}): FixtureFiles {
  const written = project(files, { [CONFIG_FILE]: config({ stack: { style: 'declared' } }) });

  const barrels = ['billing', 'catalog'].map((context): [string, string] => {
    const directory = `src/contexts/${context}/`;

    const inside = Object.keys(written).flatMap((file) =>
      file.startsWith(directory) ? [file.slice(directory.length)] : [],
    );

    return [`${directory}${barrelFile(context)}`, renderBarrel(inside, `@/contexts/${context}`)];
  });

  return { ...written, ...Object.fromEntries(barrels), ...overrides };
}
