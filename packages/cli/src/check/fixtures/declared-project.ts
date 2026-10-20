import { CONFIG_FILE } from '../../config/index.js';
import { renderDeclarations } from '../../declared/index.js';
import { config } from './config.js';
import type { FixtureFiles } from './fixture-files.js';
import { project } from './project.js';

const NOTHING_INJECTED = { imports: [], calls: [] };

/**
 * The same two contexts in the declared style, each with the declarations of the role files it
 * is given, `overrides` included: a fixture that writes a declarations file out wins over them.
 */
export function declaredProject(files: FixtureFiles, overrides: FixtureFiles = {}): FixtureFiles {
  const written = project(files, { [CONFIG_FILE]: config({ stack: { style: 'declared' } }) });
  const tree = Object.keys({ ...written, ...overrides });

  const declarations = ['billing', 'catalog'].flatMap((context): [string, string][] => {
    const directory = `src/contexts/${context}/`;
    const inside = tree.flatMap((file) => (file.startsWith(directory) ? [file.slice(directory.length)] : []));

    const rendered = renderDeclarations({
      context,
      files: inside,
      specifierOf: (entry) => `@/contexts/${context}/${entry.replace(/\.ts$/, '.js')}`,
      injectedIn: () => NOTHING_INJECTED,
    });

    return [...rendered].map(([file, content]) => [`${directory}${file}`, content]);
  });

  return { ...written, ...Object.fromEntries(declarations), ...overrides };
}
