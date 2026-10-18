import type { Config } from '../config/index.js';
import { toName } from '../naming/index.js';
import type { Workspace } from '../workspace/index.js';

interface Tree {
  readonly ws: Workspace;
  readonly config: Config;
}

/** The names of the aggregates of a context, in PascalCase. */
export function aggregatesOf({ ws, config }: Tree, context: string): string[] {
  return ws
    .list(`${config.contextsDir}/${context}/domain/aggregates`)
    .filter((name) => name.endsWith('.aggregate.ts'))
    .map((name) => toName(name.replace(/\.aggregate\.ts$/, '')).pascal);
}
