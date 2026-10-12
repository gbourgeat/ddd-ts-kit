import type { Config } from '../config/index.js';
import type { Workspace } from '../workspace/index.js';

/** Every TypeScript file under the source root and under `test/` at the root of the project. */
export function projectSources(ws: Workspace, config: Config): string[] {
  return [config.sourceRoot, 'test'].flatMap((directory) => sourcesUnder(ws, directory));
}

function sourcesUnder(ws: Workspace, directory: string): string[] {
  const here = ws.list(directory).filter((name) => /\.(?:ts|tsx|mts)$/.test(name) && !name.endsWith('.d.ts'));

  const below = ws
    .directories(directory)
    .filter((name) => name !== 'node_modules' && name !== 'dist' && name !== 'generated')
    .flatMap((name) => sourcesUnder(ws, `${directory}/${name}`));

  return [...here.map((name) => `${directory}/${name}`), ...below];
}
