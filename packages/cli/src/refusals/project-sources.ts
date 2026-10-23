import type { Config } from '../config';
import type { Workspace } from '../workspace';

/** Every TypeScript file under the source root, under `test/` at the root of the project, and under the other directories named. */
export function projectSources(ws: Workspace, config: Config, others: readonly string[] = []): string[] {
  return [config.sourceRoot, 'test', ...others].flatMap((directory) => sourcesUnder(ws, directory));
}

function sourcesUnder(ws: Workspace, directory: string): string[] {
  const here = ws.list(directory).filter((name) => /\.(?:ts|tsx|mts)$/.test(name) && !name.endsWith('.d.ts'));

  const below = ws
    .directories(directory)
    .filter((name) => name !== 'node_modules' && name !== 'dist' && name !== 'generated')
    .flatMap((name) => sourcesUnder(ws, `${directory}/${name}`));

  return [...here.map((name) => `${directory}/${name}`), ...below];
}
